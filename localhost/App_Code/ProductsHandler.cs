using System;
using System.Collections.Generic;
using System.Web;

public class ProductsHandler : ApiHandlerBase
{
    protected override void HandleRequest(HttpContext context)
    {
        IDictionary<string, object> user = RequireUser(context);
        RequireCoreAccess(user);

        Dictionary<string, object> body = JsonUtil.ReadBody(context);
        string action = JsonUtil.GetString(body, "action");

        if (action == "save")
        {
            string productId = Save(body);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã lưu sản phẩm / dịch vụ.", productId = productId });
            return;
        }
        if (action == "delete")
        {
            Delete(body);
            JsonUtil.Write(context, 200, new { ok = true, message = "Đã xóa sản phẩm / dịch vụ." });
            return;
        }

        throw new ApplicationException("Hành động sản phẩm không hợp lệ.");
    }

    private string Save(IDictionary<string, object> body)
    {
        string id = JsonUtil.GetString(body, "productId");
        string name = JsonUtil.GetString(body, "name");
        string code = JsonUtil.GetString(body, "code");
        decimal defaultPrice = JsonUtil.GetDecimal(body, "defaultPrice");
        string note = JsonUtil.GetString(body, "note");

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ApplicationException("Tên sản phẩm / dịch vụ là bắt buộc.");
        }

        if (string.IsNullOrWhiteSpace(id))
        {
            id = Guid.NewGuid().ToString();
            DbUtil.ExecuteNonQuery(
                "INSERT INTO Products (ProductId, Name, Code, DefaultPrice, Note, CreatedAt, UpdatedAt) VALUES (@ProductId, @Name, @Code, @DefaultPrice, @Note, NOW(), NOW())",
                DbUtil.Param("@ProductId", id),
                DbUtil.Param("@Name", name),
                DbUtil.Param("@Code", code),
                DbUtil.Param("@DefaultPrice", defaultPrice),
                DbUtil.Param("@Note", note)
            );
        }
        else
        {
            DbUtil.ExecuteNonQuery(
                "UPDATE Products SET Name = @Name, Code = @Code, DefaultPrice = @DefaultPrice, Note = @Note, UpdatedAt = NOW() WHERE ProductId = @ProductId",
                DbUtil.Param("@Name", name),
                DbUtil.Param("@Code", code),
                DbUtil.Param("@DefaultPrice", defaultPrice),
                DbUtil.Param("@Note", note),
                DbUtil.Param("@ProductId", id)
            );
        }

        return id;
    }

    private void Delete(IDictionary<string, object> body)
    {
        string id = JsonUtil.GetString(body, "productId");
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ApplicationException("Không tìm thấy sản phẩm cần xóa.");
        }

        DbUtil.ExecuteNonQuery("DELETE FROM Products WHERE ProductId = @ProductId", DbUtil.Param("@ProductId", id));
    }
}
