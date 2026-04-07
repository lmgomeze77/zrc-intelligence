const express=require("express");
const router=express.Router();
const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY;
router.post("/",async(req,res)=>{
  const{email,name}=req.body;
  if(!email||!email.includes("@"))return res.status(400).json({error:"Valid email required"});
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/subscribers`,{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Prefer:"return=minimal"},
      body:JSON.stringify({email:email.toLowerCase().trim(),name:name||null})
    });
    if(response.status===409)return res.status(409).json({error:"Already subscribed"});
    if(!response.ok)throw new Error("Supabase insert failed");
    return res.status(201).json({message:"Subscribed successfully"});
  }catch(err){console.error("Subscribe error:",err);return res.status(500).json({error:"Subscription failed."});}
});
module.exports=router;