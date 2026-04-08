<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Net" %>
<%@ Import Namespace="System.Collections.Generic" %>
<%@ Import Namespace="System.Text.RegularExpressions" %>
<script runat="server">
  private sealed class ProbeResult
  {
    public string Url;
    public string Value;
    public string Error;
  }

  private static readonly Regex IPv4Regex = new Regex(@"\b((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b", RegexOptions.Compiled);
  private static readonly Regex IPv6Regex = new Regex(@"\b([0-9a-fA-F]{1,4}:){2,}[0-9a-fA-F:]{1,39}\b", RegexOptions.Compiled);

  protected void Page_Load(object sender, EventArgs e)
  {
    // Cố gắng ưu tiên TLS mới; vẫn cho phép fallback để host cũ không lỗi compile/runtime.
    ServicePointManager.Expect100Continue = false;
    ServicePointManager.SecurityProtocol = (SecurityProtocolType)(3072 | 768 | 192 | 48);

    int runs = ParseRuns(Request["runs"]);
    string incoming = Request.UserHostAddress ?? string.Empty;
    string nowUtc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");
    string host = Environment.MachineName ?? string.Empty;

    string[] endpoints = new[]
    {
      "http://api4.my-ip.io/ip.txt",
      "http://api6.my-ip.io/ip.txt",
      "http://ifconfig.me/ip",
      "https://api64.ipify.org",
      "https://api.ipify.org",
      "https://ifconfig.me/ip",
      "https://ipv4.icanhazip.com",
      "https://ipv6.icanhazip.com"
    };

    HashSet<string> ipv4Set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    HashSet<string> ipv6Set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    Response.Clear();
    Response.ContentType = "text/plain; charset=utf-8";
    Response.Cache.SetCacheability(HttpCacheability.NoCache);
    Response.Cache.SetNoStore();
    Response.Write("NOW_UTC=" + nowUtc + "\n");
    Response.Write("HOST_NAME=" + host + "\n");
    Response.Write("INCOMING_TO_HOST=" + incoming + "\n");
    Response.Write("RUNS=" + runs + "\n");
    Response.Write("-----\n");

    for (int i = 1; i <= runs; i++)
    {
      Response.Write("RUN_" + i + ":\n");
      for (int k = 0; k < endpoints.Length; k++)
      {
        string url = endpoints[k];
        ProbeResult result = Probe(url);
        string label = "  [" + (k + 1) + "] " + url + " => ";
        if (!string.IsNullOrWhiteSpace(result.Error))
        {
          Response.Write(label + "ERR: " + result.Error + "\n");
          continue;
        }

        string value = (result.Value ?? string.Empty).Trim();
        Response.Write(label + value + "\n");

        string ipv4 = ExtractIPv4(value);
        if (!string.IsNullOrWhiteSpace(ipv4))
        {
          ipv4Set.Add(ipv4);
        }

        string ipv6 = ExtractIPv6(value);
        if (!string.IsNullOrWhiteSpace(ipv6))
        {
          ipv6Set.Add(ipv6);
        }
      }
      Response.Write("-----\n");
    }

    Response.Write("SUMMARY_IPV4_COUNT=" + ipv4Set.Count + "\n");
    Response.Write("SUMMARY_IPV4_VALUES=" + string.Join(",", ipv4Set) + "\n");
    Response.Write("SUMMARY_IPV6_COUNT=" + ipv6Set.Count + "\n");
    Response.Write("SUMMARY_IPV6_VALUES=" + string.Join(",", ipv6Set) + "\n");
  }

  private int ParseRuns(string raw)
  {
    int runs;
    if (!int.TryParse(raw, out runs))
    {
      runs = 3;
    }
    if (runs < 1) runs = 1;
    if (runs > 10) runs = 10;
    return runs;
  }

  private ProbeResult Probe(string url)
  {
    ProbeResult result = new ProbeResult();
    result.Url = url;

    try
    {
      using (WebClient wc = new WebClient())
      {
        wc.Headers["User-Agent"] = "AhaShine-Outbound-IP-Probe";
        wc.Headers["Cache-Control"] = "no-cache";
        wc.Encoding = System.Text.Encoding.UTF8;
        result.Value = wc.DownloadString(url + (url.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks);
        result.Error = string.Empty;
      }
    }
    catch (Exception ex)
    {
      result.Error = ex.Message;
      result.Value = string.Empty;
    }
    return result;
  }

  private string ExtractIPv4(string text)
  {
    if (string.IsNullOrWhiteSpace(text))
    {
      return string.Empty;
    }
    Match m = IPv4Regex.Match(text);
    return m.Success ? m.Value : string.Empty;
  }

  private string ExtractIPv6(string text)
  {
    if (string.IsNullOrWhiteSpace(text))
    {
      return string.Empty;
    }
    Match m = IPv6Regex.Match(text);
    return m.Success ? m.Value : string.Empty;
  }
</script>
