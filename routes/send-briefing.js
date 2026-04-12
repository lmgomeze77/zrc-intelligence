const express=require("express");
const router=express.Router();
const{Resend}=require("resend");
const resend=new Resend(process.env.RESEND_API_KEY);
const SUPABASE_URL=process.env.SUPABASE_URL,SUPABASE_KEY=process.env.SUPABASE_ANON_KEY;
const CRON_SECRET=process.env.CRON_SECRET,ANTHROPIC_KEY=process.env.ANTHROPIC_API_KEY;
async function getSubscribers(){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/subscribers?active=eq.true&select=email,name,unsubscribe_token`,
    {headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!res.ok)throw new Error("Failed to fetch subscribers");
  return res.json();
}
async function generateBriefing(){
  const today=new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model:"claude-opus-4-20250514",max_tokens:1500,messages:[{role:"user",content:`You are the ZRC Morning Intelligence editor at Zenith Rise Capital. Generate today's briefing for ${today}. Structure as clean EMAIL-SAFE HTML using only inline styles, <table>, <tr>, <td>, <p>, <span>, and <a> tags — NO <div>, NO flexbox, NO CSS classes, NO buttons. Use section headers as <td> with background:#0a1628, color:#c9a84c, padding:12px 20px, font-size:12px, letter-spacing:2px, font-family:monospace. Use body text as <td> with color:#1e293b, font-size:14px, line-height:1.7, padding:12px 20px, font-family:Georgia,serif. Sections: 1. MACRO SNAPSHOT 2. GEOPOLITICAL RISK RADAR 3. COMMODITY & ENERGY SIGNALS 4. ZRC INSIGHT OF THE DAY. Do NOT include any CTA buttons, footers, or branding — those are handled by the wrapper template. Neutrality rules: attribute every claim to a named source, use neutral verbs (reports, announces, confirms, estimates), never editorialize, quantify instead of characterize, apply symmetric framing to all parties in disputes.`}]})
  });
  const data=await response.json();
  if(!data.content?.[0])throw new Error("Anthropic empty response");
  return data.content[0].text;
}
function buildHtml(content,name,token){
  const today=new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const base=process.env.BASE_URL||"https://zrc-api.onrender.com";
  const unsubUrl=`${base}/api/unsubscribe?token=${token}`;
  const greeting=name?`Good morning, ${name}.`:"Good morning.";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:20px;">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td style="background:#0a1628;padding:32px 40px;text-align:center;">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">Zenith Rise Capital</p>
    <h1 style="color:#ffffff;font-size:22px;font-weight:300;margin:0;">ZRC Morning Intelligence</h1>
    <p style="color:#8899aa;font-size:13px;margin:8px 0 0;">${today}</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:28px 40px 0;">
    <p style="color:#334155;font-size:14px;margin:0;">${greeting}</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:20px 40px 28px;color:#1e293b;font-size:14px;line-height:1.7;">
    ${content}
  </td></tr>
  <tr><td style="padding:20px 0;" align="center">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#c9a84c;padding:14px 32px;border-radius:4px;">
        <a href="https://zenith-news-room.netlify.app" style="color:#0a1628;font-size:12px;font-family:monospace;text-decoration:none;font-weight:700;white-space:nowrap;">FULL BRIEFING &rarr;</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;">Zenith Rise Capital &middot; Calesius Global S.L. &middot; Madrid</p>
    <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;"><a href="https://zenithrisecapital.com" style="color:#94a3b8;text-decoration:none;">zenithrisecapital.com</a></p>
    <p style="color:#94a3b8;font-size:10px;margin:0;"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> &middot; For informational purposes only.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}
router.post("/",async(req,res)=>{
  if(req.headers["x-cron-secret"]!==CRON_SECRET)return res.status(401).json({error:"Unauthorized"});
  try{
    const[subscribers,briefingContent]=await Promise.all([getSubscribers(),generateBriefing()]);
    if(!subscribers.length)return res.json({message:"No active subscribers."});
    const results=await Promise.allSettled(subscribers.map(sub=>resend.emails.send({
      from:"ZRC Morning Intelligence <briefing@zenithrisecapital.com>",
      to:sub.email,
      subject:`ZRC Morning Intelligence · ${new Date().toLocaleDateString("es-ES")}`,
      html:buildHtml(briefingContent,sub.name,sub.unsubscribe_token)
    })));
    const sent=results.filter(r=>r.status==="fulfilled").length;
    const failed=results.filter(r=>r.status==="rejected").length;
    return res.json({sent,failed,total:subscribers.length});
  }catch(err){console.error(err);return res.status(500).json({error:err.message});}
});
module.exports=router;