using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using Npgsql;

public static class DbUtil
{
    private static readonly Dictionary<string, string> ColumnAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { "userid", "UserId" },
        { "username", "Username" },
        { "phone", "Phone" },
        { "displayname", "DisplayName" },
        { "rolekey", "RoleKey" },
        { "isactive", "IsActive" },
        { "createdat", "CreatedAt" },
        { "customerid", "CustomerId" },
        { "customername", "CustomerName" },
        { "email", "Email" },
        { "note", "Note" },
        { "productid", "ProductId" },
        { "productname", "ProductName" },
        { "code", "Code" },
        { "defaultprice", "DefaultPrice" },
        { "visitid", "VisitId" },
        { "referralid", "ReferralId" },
        { "referreruserid", "ReferrerUserId" },
        { "referrername", "ReferrerName" },
        { "visitdate", "VisitDate" },
        { "revenue", "Revenue" },
        { "occurrenceinmonth", "OccurrenceInMonth" },
        { "voucherrate", "VoucherRate" },
        { "voucheramount", "VoucherAmount" },
        { "commissionrate", "CommissionRate" },
        { "commissionamount", "CommissionAmount" },
        { "pointeventid", "PointEventId" },
        { "memberuserid", "MemberUserId" },
        { "membername", "MemberName" },
        { "points", "Points" },
        { "reasondetail", "ReasonDetail" },
        { "ispublic", "IsPublic" },
        { "awardedbyuserid", "AwardedByUserId" },
        { "awardedbyname", "AwardedByName" },
        { "awardedat", "AwardedAt" },
        { "monthkey", "MonthKey" },
        { "otprequestid", "OtpRequestId" },
        { "expiresat", "ExpiresAt" },
        { "verifiedat", "VerifiedAt" },
        { "status", "Status" },
        { "attemptcount", "AttemptCount" },
        { "name", "Name" }
    };

    private static readonly string[] EnvConnectionKeys = new[]
    {
        "DATAAHA_CONNECTION_STRING",
        "DATAAHA_CONNSTR",
        "DATA_AHA_CONNECTION_STRING"
    };

    public static string ConnectionString
    {
        get
        {
            string envConnection = ReadConnectionStringFromEnvironment();
            if (!string.IsNullOrWhiteSpace(envConnection))
            {
                return envConnection;
            }

            ConnectionStringSettings configured = ConfigurationManager.ConnectionStrings["DataAhaConnectionString"];
            if (configured != null && !string.IsNullOrWhiteSpace(configured.ConnectionString))
            {
                return configured.ConnectionString;
            }

            throw new ApplicationException("Chưa cấu hình chuỗi kết nối PostgreSQL cho Data Aha.");
        }
    }

    private static string ReadConnectionStringFromEnvironment()
    {
        for (int i = 0; i < EnvConnectionKeys.Length; i++)
        {
            string value = Environment.GetEnvironmentVariable(EnvConnectionKeys[i]);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    public static NpgsqlParameter Param(string name, object value)
    {
        return new NpgsqlParameter(name, value ?? DBNull.Value);
    }

    public static DataTable ExecuteDataTable(string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlConnection conn = new NpgsqlConnection(ConnectionString))
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn))
        using (NpgsqlDataAdapter adapter = new NpgsqlDataAdapter(cmd))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }

            DataTable table = new DataTable();
            conn.Open();
            adapter.Fill(table);
            return table;
        }
    }

    public static int ExecuteNonQuery(string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlConnection conn = new NpgsqlConnection(ConnectionString))
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }

            conn.Open();
            return cmd.ExecuteNonQuery();
        }
    }

    public static object ExecuteScalar(string sql, params NpgsqlParameter[] parameters)
    {
        using (NpgsqlConnection conn = new NpgsqlConnection(ConnectionString))
        using (NpgsqlCommand cmd = new NpgsqlCommand(sql, conn))
        {
            if (parameters != null && parameters.Length > 0)
            {
                cmd.Parameters.AddRange(parameters);
            }

            conn.Open();
            return cmd.ExecuteScalar();
        }
    }

    public static List<Dictionary<string, object>> ToRows(DataTable table)
    {
        List<Dictionary<string, object>> rows = new List<Dictionary<string, object>>();
        foreach (DataRow row in table.Rows)
        {
            Dictionary<string, object> item = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (DataColumn column in table.Columns)
            {
                string key = NormalizeColumnName(column.ColumnName);
                object value = row[column];
                if (value == DBNull.Value)
                {
                    item[key] = null;
                }
                else if (value is DateTime)
                {
                    item[key] = ((DateTime)value).ToString("s");
                }
                else if (value is Guid)
                {
                    item[key] = value.ToString();
                }
                else
                {
                    item[key] = value;
                }
            }
            rows.Add(item);
        }
        return rows;
    }

    private static string NormalizeColumnName(string name)
    {
        string alias;
        if (ColumnAliases.TryGetValue(name ?? string.Empty, out alias))
        {
            return alias;
        }
        return name ?? string.Empty;
    }
}
