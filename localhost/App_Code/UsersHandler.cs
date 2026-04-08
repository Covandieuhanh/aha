using System;
using System.Collections.Generic;
using System.Web;

public class UsersHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        RequireAdmin(user);

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "update")
        {
            UpdateUser(body, user);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã cập nhật tài khoản." });
            return;
        }

        throw new ApplicationException("Hành động tài khoản không hợp lệ.");
    }

    private void UpdateUser(IDictionary<string, object> body, IDictionary<string, object> currentUser)
    {
        string userId = JsonUtil.GetString(body, "userId");
        string roleKey = JsonUtil.GetString(body, "roleKey");
        bool isActive = JsonUtil.GetBool(body, "isActive", true);

        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new ApplicationException("Không tìm thấy tài khoản.");
        }
        if (roleKey != "admin" && roleKey != "operator" && roleKey != "member")
        {
            throw new ApplicationException("Vai trò không hợp lệ.");
        }
        if (string.Equals(userId, JsonUtil.GetString(currentUser, "UserId"), StringComparison.OrdinalIgnoreCase))
        {
            if (!isActive)
            {
                throw new ApplicationException("Không thể tự khóa tài khoản đang đăng nhập.");
            }
            if (roleKey != "admin")
            {
                throw new ApplicationException("Không thể tự hạ quyền admin của chính mình.");
            }
        }

        DbUtil.ExecuteNonQuery(
            "UPDATE Users SET RoleKey = @RoleKey, IsActive = @IsActive WHERE UserId = @UserId",
            DbUtil.Param("@RoleKey", roleKey),
            DbUtil.Param("@IsActive", isActive),
            DbUtil.Param("@UserId", userId)
        );
    }
}
