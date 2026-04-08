<%@ Page Language="C#" %>
<%@ Import Namespace="System.Net" %>
<script runat="server">
  private string Fetch(string url)
  {
    try
    {
      using (WebClient wc = new WebClient())
      {
        wc.Headers["User-Agent"] = "AhaShine-Outbound-IP-Check";
        return wc.DownloadString(url).Trim();
      }
    }
    catch (System.Exception ex)
    {
      return "ERR: " + ex.Message;
    }
  }

  protected void Page_Load(object sender, System.EventArgs e)
  {
    string ip1 = Fetch("https://api.ipify.org");
    string ip2 = Fetch("https://ifconfig.me/ip");
    string incoming = Request.UserHostAddress ?? string.Empty;

    Response.ContentType = "text/plain; charset=utf-8";
    Response.Write("INCOMING_TO_HOST=" + incoming + "\n");
    Response.Write("OUTBOUND_IP_1=" + ip1 + "\n");
    Response.Write("OUTBOUND_IP_2=" + ip2 + "\n");
  }
</script>
