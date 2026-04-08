using System;
using System.Collections.Generic;
using System.Web;
using System.Web.SessionState;

public abstract class ApiHandlerBase : IHttpHandler, IRequiresSessionState
{
    public bool IsReusable
    {
        get { return false; }
    }

    public void ProcessRequest(HttpContext context)
    {
        AppBootstrap.EnsureSystemReady();
        try
        {
            HandleRequest(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            JsonUtil.Write(context, 401, new { ok = false, message = ex.Message });
        }
        catch (ApplicationException ex)
        {
            JsonUtil.Write(context, 400, new { ok = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            JsonUtil.Write(context, 500, new { ok = false, message = ex.Message });
        }
    }

    protected abstract void HandleRequest(HttpContext context);

    protected Dictionary<string, object> RequireUser(HttpContext context)
    {
        Dictionary<string, object> user = AuthUtil.GetCurrentUser(context);
        if (user == null)
        {
            throw new UnauthorizedAccessException("Phiên đăng nhập đã hết hạn.");
        }

        if (!Convert.ToBoolean(user["IsActive"]))
        {
            throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");
        }

        return user;
    }

    protected void RequireAdmin(IDictionary<string, object> user)
    {
        if (!AuthUtil.IsAdmin(user))
        {
            throw new UnauthorizedAccessException("Bạn không có quyền quản trị.");
        }
    }

    protected void RequireCoreAccess(IDictionary<string, object> user)
    {
        if (!AuthUtil.CanManageCore(user))
        {
            throw new UnauthorizedAccessException("Bạn không có quyền thực hiện thao tác này.");
        }
    }

    protected void RequirePointAccess(IDictionary<string, object> user)
    {
        if (!AuthUtil.CanAwardPoints(user))
        {
            throw new UnauthorizedAccessException("Bạn không có quyền cộng điểm.");
        }
    }
}
