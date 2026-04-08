using System;
using System.Collections.Generic;
using System.Web;

public class OtpSettingsHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        RequireAdmin(user);

        if (string.Equals(context.Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
        {
            WriteCurrentSettings(context, string.Empty);
            return;
        }

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");
        if (string.IsNullOrWhiteSpace(action) || action == "get")
        {
            WriteCurrentSettings(context, string.Empty);
            return;
        }

        if (action == "save")
        {
            OtpProviderConfigUtil.SaveFromPayload(body, JsonUtil.GetString(user, "UserId"));
            WriteCurrentSettings(context, "Đã lưu cấu hình OTP.");
            return;
        }

        throw new ApplicationException("Hành động cấu hình OTP không hợp lệ.");
    }

    private void WriteCurrentSettings(HttpContext context, string message)
    {
        JsonUtil.Write(context, 200, new
        {
            ok = true,
            message = message,
            settings = OtpProviderConfigUtil.ToPayload(OtpProviderConfigUtil.Load())
        });
    }
}
