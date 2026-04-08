using System;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Web.Script.Serialization;

public class OtpProviderConfigData
{
    public string Endpoint;
    public string ApiKey;
    public string Sender;
    public string Template;
    public string HttpMethod;
    public bool IsDevMode;
    public List<Dictionary<string, string>> ParamPairs;
}

public static class OtpProviderConfigUtil
{
    private const string DefaultConfigId = "default";
    private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();
    private static readonly object StorageLock = new object();
    private static bool StorageReady;

    public static void EnsureStorageReady()
    {
        if (StorageReady)
        {
            return;
        }

        lock (StorageLock)
        {
            if (StorageReady)
            {
                return;
            }

            DbUtil.ExecuteNonQuery(
                "CREATE TABLE IF NOT EXISTS OtpProviderSettings (" +
                "ConfigId varchar(40) PRIMARY KEY, " +
                "Endpoint text NOT NULL DEFAULT '', " +
                "ApiKey varchar(300) NOT NULL DEFAULT '', " +
                "Sender varchar(120) NOT NULL DEFAULT '', " +
                "Template text NOT NULL DEFAULT '', " +
                "HttpMethod varchar(10) NOT NULL DEFAULT 'GET', " +
                "ParamPairsJson text NOT NULL DEFAULT '[]', " +
                "IsDevMode boolean NOT NULL DEFAULT TRUE, " +
                "UpdatedAt timestamp NOT NULL DEFAULT NOW(), " +
                "UpdatedByUserId varchar(40)" +
                ")"
            );

            object existing = DbUtil.ExecuteScalar(
                "SELECT ConfigId FROM OtpProviderSettings WHERE ConfigId = @ConfigId LIMIT 1",
                DbUtil.Param("@ConfigId", DefaultConfigId)
            );
            if (existing == null || existing == DBNull.Value)
            {
                OtpProviderConfigData defaults = BuildDefaultFromAppSettings();
                Upsert(defaults, "system");
            }

            StorageReady = true;
        }
    }

    public static OtpProviderConfigData Load()
    {
        EnsureStorageReady();
        DataTable table = DbUtil.ExecuteDataTable(
            "SELECT ConfigId, Endpoint, ApiKey, Sender, Template, HttpMethod, ParamPairsJson, IsDevMode, UpdatedAt, UpdatedByUserId " +
            "FROM OtpProviderSettings WHERE ConfigId = @ConfigId LIMIT 1",
            DbUtil.Param("@ConfigId", DefaultConfigId)
        );
        if (table.Rows.Count == 0)
        {
            return BuildDefaultFromAppSettings();
        }

        return Parse(table.Rows[0]);
    }

    public static Dictionary<string, object> ToPayload(OtpProviderConfigData config)
    {
        OtpProviderConfigData safeConfig = config ?? BuildDefaultFromAppSettings();
        return new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
        {
            { "endpoint", safeConfig.Endpoint ?? string.Empty },
            { "apiKey", safeConfig.ApiKey ?? string.Empty },
            { "sender", safeConfig.Sender ?? string.Empty },
            { "template", safeConfig.Template ?? string.Empty },
            { "httpMethod", safeConfig.HttpMethod ?? "GET" },
            { "isDevMode", safeConfig.IsDevMode },
            { "paramPairs", safeConfig.ParamPairs ?? BuildDefaultParamPairs() }
        };
    }

    public static void SaveFromPayload(IDictionary<string, object> body, string updatedByUserId)
    {
        if (body == null)
        {
            throw new ApplicationException("Thiếu dữ liệu cấu hình OTP.");
        }

        OtpProviderConfigData config = new OtpProviderConfigData();
        config.Endpoint = JsonUtil.GetString(body, "endpoint");
        config.ApiKey = JsonUtil.GetString(body, "apiKey");
        config.Sender = JsonUtil.GetString(body, "sender");
        config.Template = JsonUtil.GetString(body, "template");
        config.HttpMethod = JsonUtil.GetString(body, "httpMethod");
        config.IsDevMode = JsonUtil.GetBool(body, "isDevMode", true);
        config.ParamPairs = ParseParamPairsFromPayload(body);

        if (string.IsNullOrWhiteSpace(config.HttpMethod))
        {
            config.HttpMethod = "GET";
        }
        config.HttpMethod = config.HttpMethod.Trim().ToUpperInvariant();
        if (config.HttpMethod != "GET" && config.HttpMethod != "POST")
        {
            config.HttpMethod = "GET";
        }

        if (!config.IsDevMode && string.IsNullOrWhiteSpace(config.Endpoint))
        {
            throw new ApplicationException("Bạn cần nhập Endpoint hoặc bật chế độ DEV.");
        }

        if (config.ParamPairs == null || config.ParamPairs.Count == 0)
        {
            config.ParamPairs = BuildDefaultParamPairs();
        }

        Upsert(config, string.IsNullOrWhiteSpace(updatedByUserId) ? "unknown" : updatedByUserId);
    }

    private static void Upsert(OtpProviderConfigData config, string updatedByUserId)
    {
        string paramPairsJson = Serializer.Serialize(config.ParamPairs ?? BuildDefaultParamPairs());
        DbUtil.ExecuteNonQuery(
            "INSERT INTO OtpProviderSettings (ConfigId, Endpoint, ApiKey, Sender, Template, HttpMethod, ParamPairsJson, IsDevMode, UpdatedAt, UpdatedByUserId) " +
            "VALUES (@ConfigId, @Endpoint, @ApiKey, @Sender, @Template, @HttpMethod, @ParamPairsJson, @IsDevMode, NOW(), @UpdatedByUserId) " +
            "ON CONFLICT (ConfigId) DO UPDATE SET " +
            "Endpoint = EXCLUDED.Endpoint, " +
            "ApiKey = EXCLUDED.ApiKey, " +
            "Sender = EXCLUDED.Sender, " +
            "Template = EXCLUDED.Template, " +
            "HttpMethod = EXCLUDED.HttpMethod, " +
            "ParamPairsJson = EXCLUDED.ParamPairsJson, " +
            "IsDevMode = EXCLUDED.IsDevMode, " +
            "UpdatedAt = NOW(), " +
            "UpdatedByUserId = EXCLUDED.UpdatedByUserId",
            DbUtil.Param("@ConfigId", DefaultConfigId),
            DbUtil.Param("@Endpoint", config.Endpoint ?? string.Empty),
            DbUtil.Param("@ApiKey", config.ApiKey ?? string.Empty),
            DbUtil.Param("@Sender", config.Sender ?? string.Empty),
            DbUtil.Param("@Template", config.Template ?? string.Empty),
            DbUtil.Param("@HttpMethod", config.HttpMethod ?? "GET"),
            DbUtil.Param("@ParamPairsJson", paramPairsJson),
            DbUtil.Param("@IsDevMode", config.IsDevMode),
            DbUtil.Param("@UpdatedByUserId", updatedByUserId ?? string.Empty)
        );
    }

    private static OtpProviderConfigData Parse(DataRow row)
    {
        OtpProviderConfigData config = new OtpProviderConfigData();
        config.Endpoint = Convert.ToString(row["Endpoint"]);
        config.ApiKey = Convert.ToString(row["ApiKey"]);
        config.Sender = Convert.ToString(row["Sender"]);
        config.Template = Convert.ToString(row["Template"]);
        config.HttpMethod = Convert.ToString(row["HttpMethod"]);
        config.IsDevMode = row["IsDevMode"] != DBNull.Value && Convert.ToBoolean(row["IsDevMode"]);
        config.ParamPairs = DeserializeParamPairs(Convert.ToString(row["ParamPairsJson"]));
        if (string.IsNullOrWhiteSpace(config.HttpMethod))
        {
            config.HttpMethod = "GET";
        }
        if (config.ParamPairs == null || config.ParamPairs.Count == 0)
        {
            config.ParamPairs = BuildDefaultParamPairs();
        }
        return config;
    }

    private static OtpProviderConfigData BuildDefaultFromAppSettings()
    {
        string mode = Convert.ToString(ConfigurationManager.AppSettings["OtpMode"] ?? "dev");
        bool isDevMode = !string.Equals(mode, "external", StringComparison.OrdinalIgnoreCase);
        string endpoint = Convert.ToString(ConfigurationManager.AppSettings["OtpProviderUrl"] ?? string.Empty);
        string apiKey = Convert.ToString(ConfigurationManager.AppSettings["OtpProviderToken"] ?? string.Empty);
        string sender = Convert.ToString(ConfigurationManager.AppSettings["OtpSender"] ?? "AHA SHINE");
        string template = Convert.ToString(ConfigurationManager.AppSettings["OtpTemplate"] ?? "Mã OTP của bạn là: {OTP}");
        string httpMethod = Convert.ToString(ConfigurationManager.AppSettings["OtpHttpMethod"] ?? "GET").Trim().ToUpperInvariant();
        if (httpMethod != "GET" && httpMethod != "POST")
        {
            httpMethod = "GET";
        }

        OtpProviderConfigData defaults = new OtpProviderConfigData();
        defaults.Endpoint = endpoint;
        defaults.ApiKey = apiKey;
        defaults.Sender = sender;
        defaults.Template = template;
        defaults.HttpMethod = httpMethod;
        defaults.IsDevMode = isDevMode;
        defaults.ParamPairs = BuildDefaultParamPairs();
        return defaults;
    }

    private static List<Dictionary<string, string>> ParseParamPairsFromPayload(IDictionary<string, object> body)
    {
        object raw;
        if (!body.TryGetValue("paramPairs", out raw) || raw == null)
        {
            return BuildDefaultParamPairs();
        }
        return NormalizeParamPairs(raw);
    }

    private static List<Dictionary<string, string>> DeserializeParamPairs(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return BuildDefaultParamPairs();
        }

        object parsed;
        try
        {
            parsed = Serializer.DeserializeObject(json);
        }
        catch
        {
            return BuildDefaultParamPairs();
        }
        return NormalizeParamPairs(parsed);
    }

    private static List<Dictionary<string, string>> NormalizeParamPairs(object raw)
    {
        List<Dictionary<string, string>> pairs = new List<Dictionary<string, string>>();
        IEnumerable enumerable = raw as IEnumerable;
        if (enumerable == null || raw is string)
        {
            return pairs;
        }

        foreach (object item in enumerable)
        {
            IDictionary<string, object> dict = item as IDictionary<string, object>;
            if (dict == null)
            {
                continue;
            }

            string key = dict.ContainsKey("key") && dict["key"] != null ? Convert.ToString(dict["key"]).Trim() : string.Empty;
            string value = dict.ContainsKey("value") && dict["value"] != null ? Convert.ToString(dict["value"]).Trim() : string.Empty;
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            pairs.Add(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "key", key },
                { "value", value }
            });
        }

        return pairs;
    }

    private static List<Dictionary<string, string>> BuildDefaultParamPairs()
    {
        return new List<Dictionary<string, string>>
        {
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "loginName" }, { "value", string.Empty } },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "sign" }, { "value", string.Empty } },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "serviceTypeId" }, { "value", string.Empty } },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "phoneNumber" }, { "value", "{phoneNumber}" } },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "message" }, { "value", "{message}" } },
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { { "key", "brandName" }, { "value", "{brandName}" } }
        };
    }
}
