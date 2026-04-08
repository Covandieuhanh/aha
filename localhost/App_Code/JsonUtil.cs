using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Web;
using System.Web.Script.Serialization;

public static class JsonUtil
{
    private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

    public static Dictionary<string, object> ReadBody(HttpContext context)
    {
        using (StreamReader reader = new StreamReader(context.Request.InputStream))
        {
            string body = reader.ReadToEnd();
            if (string.IsNullOrWhiteSpace(body))
            {
                return new Dictionary<string, object>();
            }

            object parsed = Serializer.DeserializeObject(body);
            Dictionary<string, object> dict = parsed as Dictionary<string, object>;
            return dict ?? new Dictionary<string, object>();
        }
    }

    public static void Write(HttpContext context, int statusCode, object payload)
    {
        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        context.Response.Cache.SetNoStore();
        context.Response.Cache.SetRevalidation(HttpCacheRevalidation.AllCaches);
        context.Response.Write(Serializer.Serialize(payload));
    }

    public static string GetString(IDictionary<string, object> payload, string key)
    {
        object value;
        if (payload == null || !payload.TryGetValue(key, out value) || value == null)
        {
            return string.Empty;
        }
        return Convert.ToString(value).Trim();
    }

    public static decimal GetDecimal(IDictionary<string, object> payload, string key)
    {
        string raw = GetString(payload, key);
        decimal value;
        return decimal.TryParse(raw, out value) ? value : 0m;
    }

    public static int GetInt(IDictionary<string, object> payload, string key)
    {
        string raw = GetString(payload, key);
        int value;
        return int.TryParse(raw, out value) ? value : 0;
    }

    public static bool GetBool(IDictionary<string, object> payload, string key, bool fallback)
    {
        object value;
        if (payload == null || !payload.TryGetValue(key, out value) || value == null)
        {
            return fallback;
        }

        if (value is bool)
        {
            return (bool)value;
        }

        string raw = Convert.ToString(value);
        if (string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) || raw == "1")
        {
            return true;
        }
        if (string.Equals(raw, "false", StringComparison.OrdinalIgnoreCase) || raw == "0")
        {
            return false;
        }
        return fallback;
    }
}
