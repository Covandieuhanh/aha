using System;
using System.Collections.Generic;
using System.Data;
using System.Web;
using Npgsql;

public class VisitsHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        RequireCoreAccess(user);

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "save")
        {
            SaveVisit(body, user);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã lưu giao dịch và đồng bộ lại voucher / hoa hồng." });
            return;
        }

        if (action == "delete")
        {
            DeleteVisit(body);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã xóa giao dịch và cập nhật lại thứ tự trong tháng." });
            return;
        }

        throw new ApplicationException("Hành động giao dịch không hợp lệ.");
    }

    private void SaveVisit(IDictionary<string, object> body, IDictionary<string, object> user)
    {
        string visitId = JsonUtil.GetString(body, "visitId");
        string customerId = JsonUtil.GetString(body, "customerId");
        string productId = JsonUtil.GetString(body, "productId");
        string referrerUserId = JsonUtil.GetString(body, "referrerUserId");
        DateTime visitDate = DomainRules.ParseVisitDate(JsonUtil.GetString(body, "visitDate"));
        decimal revenue = JsonUtil.GetDecimal(body, "revenue");
        string note = JsonUtil.GetString(body, "note");

        if (string.IsNullOrWhiteSpace(customerId) || string.IsNullOrWhiteSpace(productId))
        {
            throw new ApplicationException("Khách hàng và sản phẩm / dịch vụ là bắt buộc.");
        }

        if (revenue <= 0m)
        {
            throw new ApplicationException("Doanh thu phải lớn hơn 0.");
        }

        string newMonthKey = DomainRules.ToMonthKey(visitDate);
        string createdByUserId = Convert.ToString(user["UserId"]);

        using (NpgsqlConnection conn = new NpgsqlConnection(DbUtil.ConnectionString))
        {
            conn.Open();
            NpgsqlTransaction tx = conn.BeginTransaction();
            try
            {
                List<string> rebuildKeys = new List<string>();
                DataRow previousRow = string.IsNullOrWhiteSpace(visitId) ? null : GetVisitRow(conn, tx, visitId);
                if (!string.IsNullOrWhiteSpace(visitId) && previousRow == null)
                {
                    throw new ApplicationException("Không tìm thấy giao dịch cần sửa.");
                }

                if (previousRow != null)
                {
                    AddRebuildKey(rebuildKeys, Convert.ToString(previousRow["CustomerId"]), Convert.ToString(previousRow["MonthKey"]));
                    ExecuteNonQuery(
                        conn,
                        tx,
                        "UPDATE Visits SET CustomerId = @CustomerId, ProductId = @ProductId, ReferrerUserId = @ReferrerUserId, VisitDate = @VisitDate, Revenue = @Revenue, Note = @Note WHERE VisitId = @VisitId",
                        DbUtil.Param("@CustomerId", customerId),
                        DbUtil.Param("@ProductId", productId),
                        DbUtil.Param("@ReferrerUserId", string.IsNullOrWhiteSpace(referrerUserId) ? (object)DBNull.Value : referrerUserId),
                        DbUtil.Param("@VisitDate", visitDate),
                        DbUtil.Param("@Revenue", revenue),
                        DbUtil.Param("@Note", note),
                        DbUtil.Param("@VisitId", visitId)
                    );
                }
                else
                {
                    visitId = Guid.NewGuid().ToString();
                    ExecuteNonQuery(
                        conn,
                        tx,
                        "INSERT INTO Visits (VisitId, CustomerId, ProductId, ReferrerUserId, VisitDate, Revenue, OccurrenceInMonth, VoucherRate, VoucherAmount, Note, CreatedByUserId, CreatedAt) VALUES (@VisitId, @CustomerId, @ProductId, @ReferrerUserId, @VisitDate, @Revenue, 0, 0, 0, @Note, @CreatedByUserId, NOW())",
                        DbUtil.Param("@VisitId", visitId),
                        DbUtil.Param("@CustomerId", customerId),
                        DbUtil.Param("@ProductId", productId),
                        DbUtil.Param("@ReferrerUserId", string.IsNullOrWhiteSpace(referrerUserId) ? (object)DBNull.Value : referrerUserId),
                        DbUtil.Param("@VisitDate", visitDate),
                        DbUtil.Param("@Revenue", revenue),
                        DbUtil.Param("@Note", note),
                        DbUtil.Param("@CreatedByUserId", createdByUserId)
                    );
                }

                SyncReferral(conn, tx, visitId, customerId, productId, referrerUserId, visitDate, revenue);
                AddRebuildKey(rebuildKeys, customerId, newMonthKey);

                foreach (string key in rebuildKeys)
                {
                    string[] parts = key.Split('|');
                    if (parts.Length == 2)
                    {
                        RebuildCustomerMonth(conn, tx, parts[0], parts[1]);
                    }
                }

                tx.Commit();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
    }

    private void DeleteVisit(IDictionary<string, object> body)
    {
        string visitId = JsonUtil.GetString(body, "visitId");
        if (string.IsNullOrWhiteSpace(visitId))
        {
            throw new ApplicationException("Không tìm thấy giao dịch cần xóa.");
        }

        using (NpgsqlConnection conn = new NpgsqlConnection(DbUtil.ConnectionString))
        {
            conn.Open();
            NpgsqlTransaction tx = conn.BeginTransaction();
            try
            {
                DataRow row = GetVisitRow(conn, tx, visitId);
                if (row == null)
                {
                    throw new ApplicationException("Giao dịch không tồn tại.");
                }

                string customerId = Convert.ToString(row["CustomerId"]);
                string monthKey = Convert.ToString(row["MonthKey"]);

                ExecuteNonQuery(conn, tx, "DELETE FROM ReferralCommissions WHERE VisitId = @VisitId", DbUtil.Param("@VisitId", visitId));
                ExecuteNonQuery(conn, tx, "DELETE FROM Visits WHERE VisitId = @VisitId", DbUtil.Param("@VisitId", visitId));

                RebuildCustomerMonth(conn, tx, customerId, monthKey);
                tx.Commit();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
    }

    private void SyncReferral(NpgsqlConnection conn, NpgsqlTransaction tx, string visitId, string customerId, string productId, string referrerUserId, DateTime visitDate, decimal revenue)
    {
        if (string.IsNullOrWhiteSpace(referrerUserId))
        {
            ExecuteNonQuery(conn, tx, "DELETE FROM ReferralCommissions WHERE VisitId = @VisitId", DbUtil.Param("@VisitId", visitId));
            return;
        }

        object existingReferralId = ExecuteScalar(conn, tx, "SELECT ReferralId FROM ReferralCommissions WHERE VisitId = @VisitId LIMIT 1", DbUtil.Param("@VisitId", visitId));
        if (existingReferralId == null || existingReferralId == DBNull.Value)
        {
            string referralId = Guid.NewGuid().ToString();
            ExecuteNonQuery(
                conn,
                tx,
                "INSERT INTO ReferralCommissions (ReferralId, VisitId, ReferrerUserId, CustomerId, ProductId, VisitDate, Revenue, OccurrenceInMonth, CommissionRate, CommissionAmount, CreatedAt) VALUES (@ReferralId, @VisitId, @ReferrerUserId, @CustomerId, @ProductId, @VisitDate, @Revenue, 0, 0, 0, NOW())",
                DbUtil.Param("@ReferralId", referralId),
                DbUtil.Param("@VisitId", visitId),
                DbUtil.Param("@ReferrerUserId", referrerUserId),
                DbUtil.Param("@CustomerId", customerId),
                DbUtil.Param("@ProductId", productId),
                DbUtil.Param("@VisitDate", visitDate),
                DbUtil.Param("@Revenue", revenue)
            );
            return;
        }

        ExecuteNonQuery(
            conn,
            tx,
            "UPDATE ReferralCommissions SET ReferrerUserId = @ReferrerUserId, CustomerId = @CustomerId, ProductId = @ProductId, VisitDate = @VisitDate, Revenue = @Revenue WHERE VisitId = @VisitId",
            DbUtil.Param("@ReferrerUserId", referrerUserId),
            DbUtil.Param("@CustomerId", customerId),
            DbUtil.Param("@ProductId", productId),
            DbUtil.Param("@VisitDate", visitDate),
            DbUtil.Param("@Revenue", revenue),
            DbUtil.Param("@VisitId", visitId)
        );
    }

    private void RebuildCustomerMonth(NpgsqlConnection conn, NpgsqlTransaction tx, string customerId, string monthKey)
    {
        if (string.IsNullOrWhiteSpace(customerId) || string.IsNullOrWhiteSpace(monthKey))
        {
            return;
        }

        DataTable table = ExecuteDataTable(
            conn,
            tx,
            "SELECT VisitId, CustomerId, ProductId, ReferrerUserId, VisitDate, Revenue, CreatedAt FROM Visits WHERE CustomerId = @CustomerId AND TO_CHAR(VisitDate, 'YYYY-MM') = @MonthKey ORDER BY VisitDate ASC, CreatedAt ASC",
            DbUtil.Param("@CustomerId", customerId),
            DbUtil.Param("@MonthKey", monthKey)
        );

        for (int index = 0; index < table.Rows.Count; index++)
        {
            DataRow row = table.Rows[index];
            int occurrence = index + 1;
            decimal revenue = Convert.ToDecimal(row["Revenue"]);
            decimal rate = DomainRules.GetRateByOccurrence(occurrence);
            decimal amount = Math.Round(revenue * rate, 0);
            string visitId = Convert.ToString(row["VisitId"]);
            string referrerUserId = row["ReferrerUserId"] == DBNull.Value ? string.Empty : Convert.ToString(row["ReferrerUserId"]);

            ExecuteNonQuery(
                conn,
                tx,
                "UPDATE Visits SET OccurrenceInMonth = @OccurrenceInMonth, VoucherRate = @VoucherRate, VoucherAmount = @VoucherAmount WHERE VisitId = @VisitId",
                DbUtil.Param("@OccurrenceInMonth", occurrence),
                DbUtil.Param("@VoucherRate", rate),
                DbUtil.Param("@VoucherAmount", amount),
                DbUtil.Param("@VisitId", visitId)
            );

            if (!string.IsNullOrWhiteSpace(referrerUserId))
            {
                ExecuteNonQuery(
                    conn,
                    tx,
                    "UPDATE ReferralCommissions SET ReferrerUserId = @ReferrerUserId, CustomerId = @CustomerId, ProductId = @ProductId, VisitDate = @VisitDate, Revenue = @Revenue, OccurrenceInMonth = @OccurrenceInMonth, CommissionRate = @CommissionRate, CommissionAmount = @CommissionAmount WHERE VisitId = @VisitId",
                    DbUtil.Param("@ReferrerUserId", referrerUserId),
                    DbUtil.Param("@CustomerId", Convert.ToString(row["CustomerId"])),
                    DbUtil.Param("@ProductId", Convert.ToString(row["ProductId"])),
                    DbUtil.Param("@VisitDate", Convert.ToDateTime(row["VisitDate"])),
                    DbUtil.Param("@Revenue", revenue),
                    DbUtil.Param("@OccurrenceInMonth", occurrence),
                    DbUtil.Param("@CommissionRate", rate),
                    DbUtil.Param("@CommissionAmount", amount),
                    DbUtil.Param("@VisitId", visitId)
                );
            }
        }
    }

    private DataRow GetVisitRow(NpgsqlConnection conn, NpgsqlTransaction tx, string visitId)
    {
        DataTable table = ExecuteDataTable(
            conn,
            tx,
            "SELECT VisitId, CustomerId, TO_CHAR(VisitDate, 'YYYY-MM') AS MonthKey FROM Visits WHERE VisitId = @VisitId LIMIT 1",
            DbUtil.Param("@VisitId", visitId)
        );

        return table.Rows.Count == 0 ? null : table.Rows[0];
    }

    private static void AddRebuildKey(List<string> target, string customerId, string monthKey)
    {
        if (string.IsNullOrWhiteSpace(customerId) || string.IsNullOrWhiteSpace(monthKey))
        {
            return;
        }

        string key = customerId + "|" + monthKey;
        if (!target.Contains(key))
        {
            target.Add(key);
        }
    }

    private DataTable ExecuteDataTable(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn, tx))
        using (NpgsqlDataAdapter adapter = new NpgsqlDataAdapter(cmd))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }

            DataTable table = new DataTable();
            adapter.Fill(table);
            return table;
        }
    }

    private void ExecuteNonQuery(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, params NpgsqlParameter[] parameters)
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

    private object ExecuteScalar(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, params NpgsqlParameter[] parameters)
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
}
