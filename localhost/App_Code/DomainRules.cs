using System;

public static class DomainRules
{
    public static decimal GetRateByOccurrence(int occurrence)
    {
        int step = occurrence < 1 ? 1 : occurrence;
        if (step > 10)
        {
            step = 10;
        }
        return step * 0.05m;
    }

    public static string ToMonthKey(DateTime date)
    {
        return date.ToString("yyyy-MM");
    }

    public static DateTime ParseVisitDate(string raw)
    {
        DateTime value;
        if (DateTime.TryParse(raw, out value))
        {
            return value.Date;
        }
        return DateTime.Today;
    }
}
