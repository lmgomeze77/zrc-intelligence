const express=require("express");
const router=express.Router();
const SUPABASE_URL=process.env.SUPABASE_URL,SUPABASE_KEY=process.env.SUPABASE_ANON_KEY;
router.get("/",async(req,res)=>{
  const{token}=req.query;
  if(!token)return res.status(400).send(page("Invalid link","This unsubscribe link is invalid."));
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/subscribers?unsubscribe_token=eq.${token}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Prefer:"return=minimal"},
      body:JSON.stringify({active:false})
    });
    if(!response.ok)throw new Error("Supabase update failed");
    return res.send(page("Unsubscribed","You have been removed from ZRC Morning Intelligence."));
  }catch(err){console.error(err);return res.status(500).send(page("Error","Something went wrong."));}
});
function page(title,message){return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} · ZRC</title><style>body{font-family:"Helvetica Neue",Arial,sans-serif;background:#0a1628;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#fff;border-radius:8px;padding:48px 56px;text-align:center;max-width:420px}.label{color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px}h1{color:#0a1628;font-size:24px;font-weight:300;margin:0 0 16px}p{color:#64748b;font-size:14px;line-height:1.6;margin:0}</style></head><body><div class="card"><div class="label">Zenith Rise Capital</div><h1>${title}</h1><p>${message}</p></div></body></html>`;}
module.exports=router;