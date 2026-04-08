using System;
using System.Collections.Generic;
using System.Web;

public class CustomersHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        RequireCoreAccess(user);

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "save")
        {
            string customerId = Save(body);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã lưu khách hàng.", customerId = customerId });
            return;
        }
        if (action == "delete")
        {
            Delete(body);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã xóa khách hàng." });
            return;
        }

        throw new ApplicationException("Hành động khách hàng không hợp lệ.");
    }

    private string Save(IDictionary<string, object> body)
    {
        string id = JsonUtil.GetString(body, "customerId");
        string name = JsonUtil.GetString(body, "name");
        string phone = JsonUtil.GetString(body, "phone");
        string email = JsonUtil.GetString(body, "email");
        string note = JsonUtil.GetString(body, "note");

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ApplicationException("Tên khách hàng là bắt buộc.");
        }

        if (string.IsNullOrWhiteSpace(id))
        {
            id = Guid.NewGuid().ToString();
            DbUtil.ExecuteNonQuery(
                "INSERT INTO Customers (CustomerId, Name, Phone, Email, Note, CreatedAt, UpdatedAt) VALUES (@CustomerId, @Name, @Phone, @Email, @Note, NOW(), NOW())",
                DbUtil.Param("@CustomerId", id),
                DbUtil.Param("@Name", name),
                DbUtil.Param("@Phone", phone),
                DbUtil.Param("@Email", email),
                DbUtil.Param("@Note", note)
            );
        }
        else
        {
            DbUtil.ExecuteNonQuery(
                "UPDATE Customers SET Name = @Name, Phone = @Phone, Email = @Email, Note = @Note, UpdatedAt = NOW() WHERE CustomerId = @CustomerId",
                DbUtil.Param("@Name", name),
                DbUtil.Param("@Phone", phone),
                DbUtil.Param("@Email", email),
                DbUtil.Param("@Note", note),
                DbUtil.Param("@CustomerId", id)
            );
        }

        return id;
    }

    private void Delete(IDictionary<string, object> body)
    {
        string id = JsonUtil.GetString(body, "customerId");
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ApplicationException("Không tìm thấy khách hàng cần xóa.");
        }

        DbUtil.ExecuteNonQuery("DELETE FROM Customers WHERE CustomerId = @CustomerId", DbUtil.Param("@CustomerId", id));
    }
}
