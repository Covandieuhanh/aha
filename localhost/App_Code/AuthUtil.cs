using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using Npgsql;

public static class AuthUtil
{
    private const string AuthCookieName = "dataaha_auth";

    public static Dictionary<string, object> GetCurrentUser(HttpContext context)
    {
        string userId = GetAuthenticatedUserId(context);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        DataTable table = DbUtil.ExecuteDataTable(
            "SELECT UserId, Username, Phone, DisplayName, RoleKey, IsActive, CreatedAt FROM Users WHERE UserId = @UserId",
            DbUtil.Param("@UserId", userId)
        );

        if (table.Rows.Count == 0)
        {
            ClearAuthState(context);
            return null;
        }

        return DbUtil.ToRows(table)[0];
    }

    public static void SignIn(HttpContext context, string userId)
    {
        context.Session["user_id"] = userId;
        HttpCookie cookie = BuildAuthCookie(userId, context.Request.IsSecureConnection);
        context.Response.Cookies.Add(cookie);
    }

    public static void SignOut(HttpContext context)
    {
        ClearAuthState(context);
    }

    public static bool IsAdmin(IDictionary<string, object> user)
    {
        return string.Equals(JsonUtil.GetString(user, "RoleKey"), "admin", StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanManageCore(IDictionary<string, object> user)
    {
        string role = JsonUtil.GetString(user, "RoleKey");
        return role == "admin" || role == "operator";
    }

    public static bool CanAwardPoints(IDictionary<string, object> user)
    {
        return CanManageCore(user);
    }

    public static string GenerateOtpCode()
    {
        Random random = new Random();
        return random.Next(100000, 999999).ToString();
    }

    public static object RequestOtp(string phone, string purpose)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            throw new ApplicationException("Số điện thoại không được để trống.");
        }

        int cooldownSeconds = GetIntSetting("OtpCooldownSeconds", 45);
        int maxPerDay = GetIntSetting("OtpMaxPerDay", 20);
        string code = GenerateOtpCode();
        DateTime expiresAt = DateTime.Now.AddMinutes(5);
        using (NpgsqlConnection conn = new NpgsqlConnection(DbUtil.ConnectionString))
        {
            conn.Open();
            NpgsqlTransaction tx = conn.BeginTransaction(IsolationLevel.Serializable);
            try
            {
                ExecuteNonQueryTx(
                    conn,
                    tx,
                    "SELECT pg_advisory_xact_lock(hashtext(@LockKey))",
                    DbUtil.Param("@LockKey", phone + "|" + purpose)
                );

                object recentOtp = ExecuteScalarTx(
                    conn,
                    tx,
                    "SELECT OtpRequestId FROM OtpRequests WHERE Phone = @Phone AND Purpose = @Purpose AND CreatedAt >= (NOW() - (@CooldownSeconds * INTERVAL '1 second')) ORDER BY CreatedAt DESC LIMIT 1",
                    DbUtil.Param("@Phone", phone),
                    DbUtil.Param("@Purpose", purpose),
                    DbUtil.Param("@CooldownSeconds", cooldownSeconds)
                );
                if (recentOtp != null && recentOtp != DBNull.Value)
                {
                    throw new ApplicationException("Vui lòng đợi thêm trước khi yêu cầu OTP mới.");
                }

                object sentCount = ExecuteScalarTx(
                    conn,
                    tx,
                    "SELECT COUNT(1) FROM OtpRequests WHERE Phone = @Phone AND Purpose = @Purpose AND CreatedAt >= CURRENT_DATE",
                    DbUtil.Param("@Phone", phone),
                    DbUtil.Param("@Purpose", purpose)
                );
                int dailyCount = sentCount == null || sentCount == DBNull.Value ? 0 : Convert.ToInt32(sentCount);
                if (dailyCount >= maxPerDay)
                {
                    throw new ApplicationException("Bạn đã vượt quá giới hạn OTP trong ngày.");
                }

                string otpRequestId = Guid.NewGuid().ToString();
                ExecuteNonQueryTx(
                    conn,
                    tx,
                    "INSERT INTO OtpRequests (OtpRequestId, Phone, Purpose, Code, ExpiresAt, CreatedAt, Status, AttemptCount) VALUES (@OtpRequestId, @Phone, @Purpose, @Code, @ExpiresAt, NOW(), @Status, 0)",
                    DbUtil.Param("@OtpRequestId", otpRequestId),
                    DbUtil.Param("@Phone", phone),
                    DbUtil.Param("@Purpose", purpose),
                    DbUtil.Param("@Code", code),
                    DbUtil.Param("@ExpiresAt", expiresAt),
                    DbUtil.Param("@Status", "sent")
                );

                tx.Commit();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }

        OtpProviderConfigData providerConfig = OtpProviderConfigUtil.Load();
        bool debugEnabled = string.Equals(ConfigurationManager.AppSettings["OtpDevDebugEnabled"], "true", StringComparison.OrdinalIgnoreCase);

        if (!providerConfig.IsDevMode && string.IsNullOrWhiteSpace(providerConfig.Endpoint))
        {
            throw new ApplicationException("Cấu hình OTP chưa có Endpoint gửi SMS.");
        }

        if (!providerConfig.IsDevMode && !string.IsNullOrWhiteSpace(providerConfig.Endpoint))
        {
            SendOtpExternal(phone, code, providerConfig);
            return new
            {
                ok = true,
                message = "Đã gửi OTP.",
                debugCode = string.Empty
            };
        }

        return new
        {
            ok = true,
            message = "OTP đã sẵn sàng ở chế độ DEV.",
            debugCode = debugEnabled ? code : string.Empty
        };
    }

    public static void VerifyOtpOrThrow(string phone, string purpose, string code)
    {
        int maxAttempt = GetIntSetting("OtpMaxVerifyAttempts", 5);
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ApplicationException("Vui lòng nhập OTP.");
        }

        DataTable table = DbUtil.ExecuteDataTable(
            "SELECT OtpRequestId, Code, ExpiresAt, VerifiedAt, Status, AttemptCount FROM OtpRequests WHERE Phone = @Phone AND Purpose = @Purpose ORDER BY CreatedAt DESC LIMIT 1",
            DbUtil.Param("@Phone", phone),
            DbUtil.Param("@Purpose", purpose)
        );

        if (table.Rows.Count == 0)
        {
            throw new ApplicationException("Không tìm thấy OTP hợp lệ.");
        }

        DataRow row = table.Rows[0];
        int attemptCount = row["AttemptCount"] == DBNull.Value ? 0 : Convert.ToInt32(row["AttemptCount"]);
        if (attemptCount >= maxAttempt)
        {
            throw new ApplicationException("OTP đã bị khóa do nhập sai quá số lần cho phép.");
        }

        string expectedCode = Convert.ToString(row["Code"]);
        if (!string.Equals(expectedCode, code, StringComparison.Ordinal))
        {
            int nextAttempt = attemptCount + 1;
            DbUtil.ExecuteNonQuery(
                "UPDATE OtpRequests SET AttemptCount = @AttemptCount, Status = @Status WHERE OtpRequestId = @OtpRequestId",
                DbUtil.Param("@AttemptCount", nextAttempt),
                DbUtil.Param("@Status", nextAttempt >= maxAttempt ? "locked" : "sent"),
                DbUtil.Param("@OtpRequestId", row["OtpRequestId"])
            );
            throw new ApplicationException("OTP không đúng.");
        }

        if (row["VerifiedAt"] != DBNull.Value)
        {
            throw new ApplicationException("OTP đã được sử dụng.");
        }

        DateTime expiresAt = Convert.ToDateTime(row["ExpiresAt"]);
        if (expiresAt < DateTime.Now)
        {
            DbUtil.ExecuteNonQuery(
                "UPDATE OtpRequests SET Status = @Status WHERE OtpRequestId = @OtpRequestId",
                DbUtil.Param("@Status", "expired"),
                DbUtil.Param("@OtpRequestId", row["OtpRequestId"])
            );
            throw new ApplicationException("OTP đã hết hạn.");
        }

        DbUtil.ExecuteNonQuery(
            "UPDATE OtpRequests SET VerifiedAt = NOW(), Status = @Status WHERE OtpRequestId = @OtpRequestId",
            DbUtil.Param("@Status", "verified"),
            DbUtil.Param("@OtpRequestId", row["OtpRequestId"])
        );
    }

    private static void SendOtpExternal(string phone, string code, OtpProviderConfigData config)
    {
        if (config == null || string.IsNullOrWhiteSpace(config.Endpoint))
        {
            throw new ApplicationException("Chưa cấu hình endpoint OTP.");
        }

        string method = string.IsNullOrWhiteSpace(config.HttpMethod) ? "GET" : config.HttpMethod.Trim().ToUpperInvariant();
        if (method != "GET" && method != "POST")
        {
            method = "GET";
        }

        Dictionary<string, string> variables = BuildOtpVariables(phone, code, config);
        Dictionary<string, string> requestParams = BuildOtpRequestParams(config.ParamPairs, variables);
        HttpWebRequest request;

        if (method == "POST")
        {
            request = (HttpWebRequest)WebRequest.Create(config.Endpoint);
            request.Method = "POST";
            request.ContentType = "application/x-www-form-urlencoded; charset=utf-8";
            byte[] bytes = Encoding.UTF8.GetBytes(ToQueryString(requestParams));
            using (System.IO.Stream stream = request.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }
        }
        else
        {
            request = (HttpWebRequest)WebRequest.Create(AppendQueryString(config.Endpoint, requestParams));
            request.Method = "GET";
        }

        request.Timeout = 15000;
        request.ReadWriteTimeout = 15000;

        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        {
            if ((int)response.StatusCode >= 400)
            {
                throw new ApplicationException("Không gửi được OTP qua provider.");
            }
        }
    }

    private static Dictionary<string, string> BuildOtpVariables(string phone, string code, OtpProviderConfigData config)
    {
        Dictionary<string, string> variables = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string sender = config.Sender ?? string.Empty;
        string nowText = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        string timestamp = Convert.ToInt64((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds).ToString();
        variables["OTP"] = code ?? string.Empty;
        variables["phoneNumber"] = phone ?? string.Empty;
        variables["brandName"] = sender;
        variables["sender"] = sender;
        variables["apiKey"] = config.ApiKey ?? string.Empty;
        variables["timestamp"] = timestamp;
        variables["now"] = nowText;
        variables["message"] = string.Empty;

        string template = string.IsNullOrWhiteSpace(config.Template) ? "Mã OTP của bạn là: {OTP}" : config.Template;
        string message = ApplyOtpTokens(template, variables);
        variables["message"] = message;
        return variables;
    }

    private static Dictionary<string, string> BuildOtpRequestParams(List<Dictionary<string, string>> paramPairs, Dictionary<string, string> variables)
    {
        Dictionary<string, string> result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (paramPairs == null)
        {
            return result;
        }

        for (int i = 0; i < paramPairs.Count; i++)
        {
            Dictionary<string, string> pair = paramPairs[i];
            if (pair == null)
            {
                continue;
            }

            string key = pair.ContainsKey("key") ? Convert.ToString(pair["key"]) : string.Empty;
            string value = pair.ContainsKey("value") ? Convert.ToString(pair["value"]) : string.Empty;
            key = (key ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            result[key] = ApplyOtpTokens(value, variables);
        }

        return result;
    }

    private static string ApplyOtpTokens(string value, Dictionary<string, string> variables)
    {
        string output = value ?? string.Empty;
        if (variables == null)
        {
            return output;
        }

        foreach (KeyValuePair<string, string> item in variables)
        {
            output = output.Replace("{" + item.Key + "}", item.Value ?? string.Empty);
        }
        return output;
    }

    private static string ToQueryString(Dictionary<string, string> parameters)
    {
        StringBuilder builder = new StringBuilder();
        if (parameters == null)
        {
            return string.Empty;
        }

        bool isFirst = true;
        foreach (KeyValuePair<string, string> item in parameters)
        {
            if (!isFirst)
            {
                builder.Append("&");
            }
            builder.Append(HttpUtility.UrlEncode(item.Key ?? string.Empty));
            builder.Append("=");
            builder.Append(HttpUtility.UrlEncode(item.Value ?? string.Empty));
            isFirst = false;
        }
        return builder.ToString();
    }

    private static string AppendQueryString(string endpoint, Dictionary<string, string> parameters)
    {
        string query = ToQueryString(parameters);
        if (string.IsNullOrWhiteSpace(query))
        {
            return endpoint;
        }
        return endpoint + (endpoint.IndexOf("?") >= 0 ? "&" : "?") + query;
    }

    private static string GetAuthenticatedUserId(HttpContext context)
    {
        object sessionUserId = context.Session["user_id"];
        if (sessionUserId != null)
        {
            return Convert.ToString(sessionUserId);
        }

        HttpCookie cookie = context.Request.Cookies[AuthCookieName];
        if (cookie == null || string.IsNullOrWhiteSpace(cookie.Value))
        {
            return string.Empty;
        }

        string userId = ValidateCookieValue(cookie.Value);
        if (!string.IsNullOrWhiteSpace(userId))
        {
            context.Session["user_id"] = userId;
        }
        return userId;
    }

    private static HttpCookie BuildAuthCookie(string userId, bool isSecure)
    {
        HttpCookie cookie = new HttpCookie(AuthCookieName, CreateCookieValue(userId));
        cookie.HttpOnly = true;
        cookie.Secure = isSecure;
        cookie.Path = "/";
        cookie.Expires = DateTime.Now.AddDays(14);
        return cookie;
    }

    private static string CreateCookieValue(string userId)
    {
        string secret = GetAuthSecret();
        string signature = ComputeSha256(userId + "|" + secret);
        return userId + "." + signature;
    }

    private static string ValidateCookieValue(string raw)
    {
        string[] parts = (raw ?? string.Empty).Split('.');
        if (parts.Length != 2)
        {
            return string.Empty;
        }

        string userId = parts[0];
        string signature = parts[1];
        string expected = ComputeSha256(userId + "|" + GetAuthSecret());
        return string.Equals(signature, expected, StringComparison.OrdinalIgnoreCase) ? userId : string.Empty;
    }

    private static string GetAuthSecret()
    {
        string secret = Convert.ToString(ConfigurationManager.AppSettings["AppAuthSecret"] ?? string.Empty);
        return string.IsNullOrWhiteSpace(secret) ? "dataaha-local-dev-secret-change-me" : secret;
    }

    private static int GetIntSetting(string key, int fallback)
    {
        int parsed;
        return int.TryParse(Convert.ToString(ConfigurationManager.AppSettings[key] ?? string.Empty), out parsed) ? parsed : fallback;
    }

    private static object ExecuteScalarTx(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn, tx))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }
            return cmd.ExecuteScalar();
        }
    }

    private static void ExecuteNonQueryTx(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn, tx))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }
            cmd.ExecuteNonQuery();
        }
    }

    private static string ComputeSha256(string value)
    {
        using (SHA256 sha = SHA256.Create())
        {
            byte[] bytes = Encoding.UTF8.GetBytes(value ?? string.Empty);
            byte[] hash = sha.ComputeHash(bytes);
            StringBuilder builder = new StringBuilder(hash.Length * 2);
            foreach (byte item in hash)
            {
                builder.Append(item.ToString("x2"));
            }
            return builder.ToString();
        }
    }

    private static void ClearAuthState(HttpContext context)
    {
        context.Session.Clear();
        context.Session.Abandon();

        HttpCookie cookie = new HttpCookie(AuthCookieName, string.Empty);
        cookie.Path = "/";
        cookie.HttpOnly = true;
        cookie.Secure = context.Request.IsSecureConnection;
        cookie.Expires = DateTime.Now.AddDays(-7);
        context.Response.Cookies.Add(cookie);
    }
}
