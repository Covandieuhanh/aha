using System;
using System.Collections.Generic;
using System.Web;

public class BootstrapHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        string month = context.Request["month"];
        if (string.IsNullOrWhiteSpace(month))
        {
            month = DateTime.Now.ToString("yyyy-MM");
        }

        bool canManage = AuthUtil.CanManageCore(user);
        bool isAdmin = AuthUtil.IsAdmin(user);
        string userId = Convert.ToString(user["UserId"]);
        List<Dictionary<string, object>> referrals;

        if (isAdmin || canManage)
        {
            referrals = DbUtil.ToRows(
                DbUtil.ExecuteDataTable(
                    "SELECT r.ReferralId, r.VisitId, r.ReferrerUserId, u.DisplayName AS ReferrerName, r.CustomerId, c.Name AS CustomerName, r.ProductId, p.Name AS ProductName, r.VisitDate, r.Revenue, r.OccurrenceInMonth, r.CommissionRate, r.CommissionAmount, r.CreatedAt FROM ReferralCommissions r INNER JOIN Users u ON u.UserId = r.ReferrerUserId INNER JOIN Customers c ON c.CustomerId = r.CustomerId INNER JOIN Products p ON p.ProductId = r.ProductId ORDER BY r.VisitDate DESC, r.CreatedAt DESC"
                )
            );
        }
        else
        {
            referrals = DbUtil.ToRows(
                DbUtil.ExecuteDataTable(
                    "SELECT r.ReferralId, r.VisitId, r.ReferrerUserId, u.DisplayName AS ReferrerName, r.CustomerId, c.Name AS CustomerName, r.ProductId, p.Name AS ProductName, r.VisitDate, r.Revenue, r.OccurrenceInMonth, r.CommissionRate, r.CommissionAmount, r.CreatedAt FROM ReferralCommissions r INNER JOIN Users u ON u.UserId = r.ReferrerUserId INNER JOIN Customers c ON c.CustomerId = r.CustomerId INNER JOIN Products p ON p.ProductId = r.ProductId WHERE r.ReferrerUserId = @UserId ORDER BY r.VisitDate DESC, r.CreatedAt DESC",
                    DbUtil.Param("@UserId", userId)
                )
            );
        }

        object payload = new
        {
            ok = true,
            currentUser = user,
            month = month,
            customers = canManage ? DbUtil.ToRows(DbUtil.ExecuteDataTable("SELECT CustomerId, Name, Phone, Email, Note, CreatedAt FROM Customers ORDER BY Name ASC")) : new List<Dictionary<string, object>>(),
            products = canManage ? DbUtil.ToRows(DbUtil.ExecuteDataTable("SELECT ProductId, Name, Code, DefaultPrice, Note, CreatedAt FROM Products ORDER BY Name ASC")) : new List<Dictionary<string, object>>(),
            visits = canManage ? DbUtil.ToRows(DbUtil.ExecuteDataTable("SELECT v.VisitId, v.CustomerId, c.Name AS CustomerName, v.ProductId, p.Name AS ProductName, v.ReferrerUserId, ru.DisplayName AS ReferrerName, v.VisitDate, v.Revenue, v.OccurrenceInMonth, v.VoucherRate, v.VoucherAmount, v.Note, v.CreatedAt FROM Visits v INNER JOIN Customers c ON c.CustomerId = v.CustomerId INNER JOIN Products p ON p.ProductId = v.ProductId LEFT JOIN Users ru ON ru.UserId = v.ReferrerUserId ORDER BY v.VisitDate DESC, v.CreatedAt DESC")) : new List<Dictionary<string, object>>(),
            referrals = referrals,
            users = canManage ? DbUtil.ToRows(DbUtil.ExecuteDataTable("SELECT UserId, Username, Phone, DisplayName, RoleKey, IsActive, CreatedAt FROM Users ORDER BY CreatedAt DESC")) : new List<Dictionary<string, object>>(),
            publicPoints = DbUtil.ToRows(
                DbUtil.ExecuteDataTable(
                    "SELECT p.PointEventId, p.MemberUserId, u.DisplayName AS MemberName, p.Points, p.ReasonDetail, p.IsPublic, p.AwardedByUserId, au.DisplayName AS AwardedByName, p.AwardedAt, p.MonthKey FROM MemberPointEvents p INNER JOIN Users u ON u.UserId = p.MemberUserId INNER JOIN Users au ON au.UserId = p.AwardedByUserId WHERE p.MonthKey = @MonthKey AND p.IsPublic = TRUE ORDER BY p.AwardedAt DESC",
                    DbUtil.Param("@MonthKey", month)
                )
            ),
            myPoints = DbUtil.ToRows(
                DbUtil.ExecuteDataTable(
                    "SELECT p.PointEventId, p.MemberUserId, u.DisplayName AS MemberName, p.Points, p.ReasonDetail, p.IsPublic, p.AwardedByUserId, au.DisplayName AS AwardedByName, p.AwardedAt, p.MonthKey FROM MemberPointEvents p INNER JOIN Users u ON u.UserId = p.MemberUserId INNER JOIN Users au ON au.UserId = p.AwardedByUserId WHERE p.MonthKey = @MonthKey AND p.MemberUserId = @UserId ORDER BY p.AwardedAt DESC",
                    DbUtil.Param("@MonthKey", month),
                    DbUtil.Param("@UserId", userId)
                )
            )
        };

        JsonUtil.Write(context, 200, payload);
    }
}
