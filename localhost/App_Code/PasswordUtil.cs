using System;
using System.Security.Cryptography;

public static class PasswordUtil
{
    public static string HashPassword(string password)
    {
        byte[] salt = new byte[16];
        using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
        {
            rng.GetBytes(salt);
        }

        const int iterations = 10000;
        using (Rfc2898DeriveBytes derive = new Rfc2898DeriveBytes(password, salt, iterations))
        {
            byte[] hash = derive.GetBytes(32);
            return iterations.ToString() + "." + Convert.ToBase64String(salt) + "." + Convert.ToBase64String(hash);
        }
    }

    public static bool VerifyPassword(string password, string encodedHash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(encodedHash))
        {
            return false;
        }

        string[] parts = encodedHash.Split('.');
        if (parts.Length != 3)
        {
            return false;
        }

        int iterations;
        if (!int.TryParse(parts[0], out iterations))
        {
            return false;
        }

        byte[] salt = Convert.FromBase64String(parts[1]);
        byte[] expected = Convert.FromBase64String(parts[2]);

        using (Rfc2898DeriveBytes derive = new Rfc2898DeriveBytes(password, salt, iterations))
        {
            byte[] actual = derive.GetBytes(expected.Length);
            return FixedTimeEquals(actual, expected);
        }
    }

    private static bool FixedTimeEquals(byte[] a, byte[] b)
    {
        if (a == null || b == null || a.Length != b.Length)
        {
            return false;
        }

        int diff = 0;
        for (int i = 0; i < a.Length; i++)
        {
            diff |= a[i] ^ b[i];
        }
        return diff == 0;
    }
}
