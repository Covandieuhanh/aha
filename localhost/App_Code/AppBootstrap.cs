using System;

public static class AppBootstrap
{
    public static void EnsureSystemReady()
    {
        EnsureAdminAccount();
        EnsureDefaultProduct();
        OtpProviderConfigUtil.EnsureStorageReady();
    }

    public static void EnsureAdminAccount()
    {
        object existing = DbUtil.ExecuteScalar("SELECT UserId FROM Users WHERE RoleKey = @RoleKey LIMIT 1", DbUtil.Param("@RoleKey", "admin"));
        if (existing != null && existing != DBNull.Value)
        {
            return;
        }

        string hash = PasswordUtil.HashPassword("admin123");
        string userId = Guid.NewGuid().ToString();
        DbUtil.ExecuteNonQuery(
            "INSERT INTO Users (UserId, Username, Phone, PasswordHash, DisplayName, RoleKey, IsActive, CreatedAt) VALUES (@UserId, @Username, @Phone, @PasswordHash, @DisplayName, @RoleKey, TRUE, NOW())",
            DbUtil.Param("@UserId", userId),
            DbUtil.Param("@Username", "admin"),
            DbUtil.Param("@Phone", "0900000000"),
            DbUtil.Param("@PasswordHash", hash),
            DbUtil.Param("@DisplayName", "Quản trị Data Aha"),
            DbUtil.Param("@RoleKey", "admin")
        );
    }

    public static void EnsureDefaultProduct()
    {
        object existing = DbUtil.ExecuteScalar("SELECT ProductId FROM Products LIMIT 1");
        if (existing != null && existing != DBNull.Value)
        {
            return;
        }

        DbUtil.ExecuteNonQuery(
            "INSERT INTO Products (ProductId, Name, Code, DefaultPrice, Note, CreatedAt, UpdatedAt) VALUES (@ProductId, @Name, @Code, @DefaultPrice, @Note, NOW(), NOW())",
            DbUtil.Param("@ProductId", Guid.NewGuid().ToString()),
            DbUtil.Param("@Name", "Dịch vụ mặc định"),
            DbUtil.Param("@Code", "DV-MD"),
            DbUtil.Param("@DefaultPrice", 1000000m),
            DbUtil.Param("@Note", "Seed tự động để hệ thống chạy lần đầu")
        );
    }
}
