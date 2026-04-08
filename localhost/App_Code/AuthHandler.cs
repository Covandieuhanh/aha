using System;
using System.Collections.Generic;
using System.Data;
using System.Web;

public class AuthHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        if (context.Request.HttpMethod == "GET")
        {
            JsonUtil.Write(context, 200, new { ok = true });
            return;
        }

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "login")
        {
            Login(context, body);
            return;
        }
        if (action == "logout")
        {
            AuthUtil.SignOut(context);
            JsonUtil.Write(context, 200, new { ok = true });
            return;
        }
        if (action == "request_register_otp")
        {
            string phone = JsonUtil.GetString(body, "phone");
            EnsurePhoneAvailable(phone);
            JsonUtil.Write(context, 200, AuthUtil.RequestOtp(phone, "register"));
            return;
        }
        if (action == "register")
        {
            Register(context, body);
            return;
        }
        if (action == "request_reset_otp")
        {
            string phone = JsonUtil.GetString(body, "phone");
            EnsurePhoneExists(phone);
            JsonUtil.Write(context, 200, AuthUtil.RequestOtp(phone, "reset_password"));
            return;
        }
        if (action == "reset_password")
        {
            ResetPassword(context, body);
            return;
        }

        throw new ApplicationException("Hành động xác thực không hợp lệ.");
    }

    private void Login(HttpContext context, IDictionary<string, object> body)
    {
        string identity = JsonUtil.GetString(body, "identity");
        string password = JsonUtil.GetString(body, "password");
        if (string.IsNullOrWhiteSpace(identity) || string.IsNullOrWhiteSpace(password))
        {
            throw new ApplicationException("Vui lòng nhập tài khoản và mật khẩu.");
        }

        DataTable table = DbUtil.ExecuteDataTable(
            "SELECT UserId, Username, Phone, PasswordHash, DisplayName, RoleKey, IsActive, CreatedAt FROM Users WHERE Username = @Identity OR Phone = @Identity LIMIT 1",
            DbUtil.Param("@Identity", identity)
        );
        if (table.Rows.Count == 0)
        {
            throw new ApplicationException("Sai thông tin đăng nhập.");
        }

        DataRow row = table.Rows[0];
        if (!Convert.ToBoolean(row["IsActive"]))
        {
            throw new ApplicationException("Tài khoản đã bị khóa.");
        }

        if (!PasswordUtil.VerifyPassword(password, Convert.ToString(row["PasswordHash"])))
        {
            throw new ApplicationException("Sai thông tin đăng nhập.");
        }

        AuthUtil.SignIn(context, Convert.ToString(row["UserId"]));
        JsonUtil.Write(context, 200, new { ok = true, user = ToSafeUser(row) });
    }

    private void Register(HttpContext context, IDictionary<string, object> body)
    {
        string displayName = JsonUtil.GetString(body, "displayName");
        string phone = JsonUtil.GetString(body, "phone");
        string otpCode = JsonUtil.GetString(body, "otpCode");
        string password = JsonUtil.GetString(body, "password");

        if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(password))
        {
            throw new ApplicationException("Thông tin đăng ký chưa đầy đủ.");
        }
        if (password.Length < 6)
        {
            throw new ApplicationException("Mật khẩu tối thiểu 6 ký tự.");
        }

        EnsurePhoneAvailable(phone);
        AuthUtil.VerifyOtpOrThrow(phone, "register", otpCode);

        string passwordHash = PasswordUtil.HashPassword(password);
        string userId = Guid.NewGuid().ToString();
        DbUtil.ExecuteNonQuery(
            "INSERT INTO Users (UserId, Username, Phone, PasswordHash, DisplayName, RoleKey, IsActive, CreatedAt) VALUES (@UserId, @Username, @Phone, @PasswordHash, @DisplayName, @RoleKey, TRUE, NOW())",
            DbUtil.Param("@UserId", userId),
            DbUtil.Param("@Username", phone),
            DbUtil.Param("@Phone", phone),
            DbUtil.Param("@PasswordHash", passwordHash),
            DbUtil.Param("@DisplayName", displayName),
            DbUtil.Param("@RoleKey", "member")
        );

        DataTable table = DbUtil.ExecuteDataTable("SELECT UserId, Username, Phone, DisplayName, RoleKey, IsActive, CreatedAt FROM Users WHERE Phone = @Phone LIMIT 1", DbUtil.Param("@Phone", phone));
        AuthUtil.SignIn(context, Convert.ToString(table.Rows[0]["UserId"]));
        JsonUtil.Write(context, 200, new { ok = true, user = ToSafeUser(table.Rows[0]) });
    }

    private void ResetPassword(HttpContext context, IDictionary<string, object> body)
    {
        string phone = JsonUtil.GetString(body, "phone");
        string otpCode = JsonUtil.GetString(body, "otpCode");
        string password = JsonUtil.GetString(body, "password");

        if (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(password))
        {
            throw new ApplicationException("Thông tin đặt lại mật khẩu chưa đầy đủ.");
        }
        if (password.Length < 6)
        {
            throw new ApplicationException("Mật khẩu mới tối thiểu 6 ký tự.");
        }

        EnsurePhoneExists(phone);
        AuthUtil.VerifyOtpOrThrow(phone, "reset_password", otpCode);

        DbUtil.ExecuteNonQuery(
            "UPDATE Users SET PasswordHash = @PasswordHash WHERE Phone = @Phone",
            DbUtil.Param("@PasswordHash", PasswordUtil.HashPassword(password)),
            DbUtil.Param("@Phone", phone)
        );

        JsonUtil.Write(context, 200, new { ok = true, message = "Đã cập nhật mật khẩu mới." });
    }

    private void EnsurePhoneAvailable(string phone)
    {
        object existing = DbUtil.ExecuteScalar("SELECT UserId FROM Users WHERE Phone = @Phone LIMIT 1", DbUtil.Param("@Phone", phone));
        if (existing != null && existing != DBNull.Value)
        {
            throw new ApplicationException("Số điện thoại đã tồn tại.");
        }
    }

    private void EnsurePhoneExists(string phone)
    {
        object existing = DbUtil.ExecuteScalar("SELECT UserId FROM Users WHERE Phone = @Phone LIMIT 1", DbUtil.Param("@Phone", phone));
        if (existing == null || existing == DBNull.Value)
        {
            throw new ApplicationException("Không tìm thấy tài khoản theo số điện thoại này.");
        }
    }

    private object ToSafeUser(DataRow row)
    {
        return new
        {
            UserId = Convert.ToString(row["UserId"]),
            Username = Convert.ToString(row["Username"]),
            Phone = Convert.ToString(row["Phone"]),
            DisplayName = Convert.ToString(row["DisplayName"]),
            RoleKey = Convert.ToString(row["RoleKey"]),
            IsActive = Convert.ToBoolean(row["IsActive"]),
            CreatedAt = Convert.ToDateTime(row["CreatedAt"]).ToString("s")
        };
    }
}
