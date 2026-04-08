using System;
using System.Collections.Generic;
using System.Web;

public class PointsHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "save")
        {
            RequirePointAccess(user);
            SavePoint(body, user);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã ghi điểm thành viên." });
            return;
        }

        throw new ApplicationException("Hành động điểm thành viên không hợp lệ.");
    }

    private void SavePoint(IDictionary<string, object> body, IDictionary<string, object> user)
    {
        string memberUserId = JsonUtil.GetString(body, "memberUserId");
        int points = JsonUtil.GetInt(body, "points");
        string reasonDetail = JsonUtil.GetString(body, "reasonDetail");
        bool isPublic = JsonUtil.GetBool(body, "isPublic", true);

        if (string.IsNullOrWhiteSpace(memberUserId))
        {
            throw new ApplicationException("Thành viên là bắt buộc.");
        }
        if (points == 0)
        {
            throw new ApplicationException("Số điểm phải khác 0.");
        }
        if (string.IsNullOrWhiteSpace(reasonDetail))
        {
            throw new ApplicationException("Lý do cộng điểm là bắt buộc.");
        }

        DateTime awardedAt = DateTime.Now;
        string monthKey = awardedAt.ToString("yyyy-MM");
        string pointEventId = Guid.NewGuid().ToString();

        DbUtil.ExecuteNonQuery(
            "INSERT INTO MemberPointEvents (PointEventId, MemberUserId, Points, ReasonDetail, IsPublic, AwardedByUserId, AwardedAt, MonthKey) VALUES (@PointEventId, @MemberUserId, @Points, @ReasonDetail, @IsPublic, @AwardedByUserId, @AwardedAt, @MonthKey)",
            DbUtil.Param("@PointEventId", pointEventId),
            DbUtil.Param("@MemberUserId", memberUserId),
            DbUtil.Param("@Points", points),
            DbUtil.Param("@ReasonDetail", reasonDetail),
            DbUtil.Param("@IsPublic", isPublic),
            DbUtil.Param("@AwardedByUserId", user["UserId"]),
            DbUtil.Param("@AwardedAt", awardedAt),
            DbUtil.Param("@MonthKey", monthKey)
        );
    }
}
