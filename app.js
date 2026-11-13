/* Production cache-bust companion: keep this script aligned with the updated HTML entrypoint. */
/* Studio startup: bind the complete interface before loading optional backend dependencies. */
const SUPABASE_URL = "https://crjacwqhajlfazcmeitw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyamFjd3FoYWpsZmF6Y21laXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MTY5NjksImV4cCI6MjExMDA5Mjk2OX0.An6dpxYF6PhkQYTdEaHbBbOhEmPQ4BKIdWEbBlhCTao";
let supabase = null;
let currentUser = null;
let currentArtist = null;
let currentRole = "artist";
let releases = [];
let editingReleaseId = null;
const statusNames={live:"Live",review:"Under review",draft:"Draft",rejected:"Needs changes"};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove("show"),3500)}
function showPage(name){const page=document.getElementById("page-"+name);if(!page)return;$$(".page").forEach(p=>p.classList.remove("active-page"));page.classList.add("active-page");$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));$("#crumb-current").textContent=({overview:"Overview",releases:"My releases",upload:"Upload music","artist-profile":"Artist profile",analytics:"Analytics",artists:"Artists",review:"Review queue"})[name];$("#sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});if(name==="releases")loadReleases();if(name==="review")renderReview()}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("#mobile-menu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
function localToday(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function releaseStatusLabel(r){return r.status==="approved"&&r.release_date&&r.release_date>localToday()?"Scheduled":(statusNames[r.status==="approved"?"live":r.status==="pending"?"review":r.status]||r.status)}
function statusBadge(status,releaseDate){const label=releaseStatusLabel({status,release_date:releaseDate});return '<span class="status '+(status==="approved"?"live":status==="pending"?"review":status==="rejected"?"rejected":"draft")+'">'+label+'</span>'}
function renderAll(){
 const query=$("#release-search").value.toLowerCase(),filter=$("#status-filter").value;
 const list=releases.filter(r=>{
  const scheduled=r.status==="approved"&&r.release_date&&r.release_date>localToday();
  const matches=filter==="all"||(filter==="live"&&r.status==="approved"&&!scheduled)||(filter==="scheduled"&&scheduled)||(filter==="review"&&r.status==="pending")||r.status===filter;
  return matches&&((r.title||"")+" "+(r.studio_artists?.stage_name||r.artist||"")).toLowerCase().includes(query);
 });
 $("#all-releases-table").innerHTML=list.length?list.map(r=>'<tr><td><div class="track-cell"><span class="cover">♫</span><span>'+escapeHtml(r.title||"Untitled draft")+'<small>'+r.id.slice(0,8)+'</small></span></div></td><td>'+escapeHtml(r.studio_artists?.stage_name||r.artist||"")+'</td><td>'+statusBadge(r.status,r.release_date)+'</td><td>'+new Date(r.created_at).toLocaleDateString()+'</td><td>—</td><td><button class="mini-button" data-detail="'+r.id+'">Details</button><button class="mini-button" data-download-toggle="'+r.id+'">'+(r.allow_downloads===false?"🔒 Downloads locked":"Downloads allowed")+"</button>"+(["draft","rejected"].includes(r.status)?'<button class="mini-button" data-edit="'+r.id+'">Edit</button>':"")+'</td></tr>').join(""):'<tr><td colspan="6" style="text-align:center;padding:30px">No releases yet. Upload your first track to get started.</td></tr>';
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#release-search").addEventListener("input",renderAll);$("#status-filter").addEventListener("change",renderAll);
function editRelease(id){
 const r=releases.find(item=>item.id===id);if(!r||!["draft","rejected"].includes(r.status))return;
 editingReleaseId=r.id;$("#track-title").value=r.title||"";$("#genre").value=r.genre||"";
 if(r.release_type&&!Array.from($("#release-type").options).some(o=>o.value===r.release_type)){const option=document.createElement("option");option.value=r.release_type;option.textContent=r.release_type+" (not currently supported)";$("#release-type").append(option);}
 $("#release-type").value=r.release_type||"Single";$("#language").value=r.language||"";
 $("#featured-artists").value=r.featured_artists||"";$("#producers").value=r.producers||"";$("#songwriters").value=r.songwriters||"";$("#composers").value=r.composers||"";
 $("#label-name").value=r.label_name||"";$("#release-date").value=r.release_date||"";
 const explicit=(r.explicit_content||"").toLowerCase();$("#explicit").value=explicit.includes("explicit")?"Explicit":explicit.includes("instrumental")?"Instrumental":explicit?"Clean":"";
 $("#isrc").value=r.isrc||"";$("#upc").value=r.upc||"";$("#lyrics").value=r.lyrics||"";$("#description").value=r.description||"";
 $("#rights-check").checked=false;$("#metadata-check").checked=false;$("#audio-file").value="";$("#art-file").value="";
 $("#audio-title").textContent=r.audio_filename||(r.audio_path?"Previously uploaded audio will be kept":"No audio uploaded yet");
 $("#art-title").textContent=r.artwork_path?"Previously uploaded cover artwork will be kept":"Upload your own cover artwork · Required";
 $("#save-draft").textContent="Update draft";$("#submit-release").textContent="Update and submit for review →";
 showValidation("release-validation",[]);showPage("upload");
}
$("#all-releases-table").addEventListener("click",e=>{
 const edit=e.target.closest("[data-edit]");if(edit){editRelease(edit.dataset.edit);return;}
 const button=e.target.closest("[data-detail]");if(!button)return;
 const r=releases.find(item=>item.id===button.dataset.detail);if(!r)return;
 const lines=["Status: "+releaseStatusLabel(r),"Genre: "+(r.genre||"Not supplied"),"Release type: "+(r.release_type||"Not supplied"),"Language: "+(r.language||"Not supplied"),"Release date: "+(r.release_date||"Not supplied"),"Featured artists: "+(r.featured_artists||"Not supplied"),"Producers: "+(r.producers||"Not supplied"),"Songwriters: "+(r.songwriters||"Not supplied"),"Composers: "+(r.composers||"Not supplied"),"Record label: "+(r.label_name||"Not supplied"),"ISRC: "+(r.isrc||"Not supplied"),"UPC/EAN: "+(r.upc||"Not supplied"),"Added: "+new Date(r.created_at).toLocaleString()];
 if(r.review_note)lines.push("Review note: "+r.review_note);openModal(r.title||"Release details",lines.join("\n"));
});
$("#all-releases-table").addEventListener("click",async e=>{const lock=e.target.closest("[data-download-toggle]");if(!lock)return;const row=releases.find(item=>item.id===lock.dataset.downloadToggle);if(!row||!currentArtist)return;const allow=row.allow_downloads===false;const {data,error}=await supabase.rpc("set_studio_track_downloads",{p_track_id:row.id,p_allow_downloads:allow});if(error){toast(error.message);return;}if(!data){toast("You do not have permission to change this release.");return;}row.allow_downloads=allow;renderAll();toast(allow?"Downloads enabled for this release.":"Downloads locked. Listeners will see a padlock and cannot save it offline.");});
async function loadReleases(){if(!currentArtist){releases=[];renderAll();return}const {data,error}=await supabase.from("studio_tracks").select("*,studio_artists(stage_name)").eq("artist_id",currentArtist.id).order("created_at",{ascending:false});if(error){toast(error.message);return}releases=data||[];renderAll();await checkReviewNotifications();}
async function renderReview(){
 if(currentRole!=="admin"){
  $("#review-list").innerHTML='<div class="panel analytics-empty"><h2>Review access is restricted</h2><p>Only a provisioned studio administrator can review and approve submissions. Artist accounts cannot approve their own music.</p></div>';
  $("#queue-count").textContent="Admin access required";return;
 }
 const {data,error}=await supabase.from("studio_tracks").select("*,studio_artists(stage_name)").eq("status","pending").order("submitted_at",{ascending:true});
 if(error){toast(error.message);return;}
 const list=data||[];$("#queue-count").textContent=list.length+" awaiting review";
 const cards=await Promise.all(list.map(async r=>{
  let audioUrl="",artUrl="";
  if(r.audio_path){const signed=await supabase.storage.from("studio-audio").createSignedUrl(r.audio_path,3600);if(!signed.error&&signed.data?.signedUrl)audioUrl=new URL(signed.data.signedUrl,SUPABASE_URL).href;}
  if(r.artwork_path){const signed=await supabase.storage.from("studio-artwork").createSignedUrl(r.artwork_path,3600);if(!signed.error&&signed.data?.signedUrl)artUrl=new URL(signed.data.signedUrl,SUPABASE_URL).href;}
  const canApprove=!!audioUrl&&!!artUrl;
  const credits=[r.producers&&("Producer: "+r.producers),r.songwriters&&("Songwriter: "+r.songwriters),r.composers&&("Composer: "+r.composers)].filter(Boolean).join(" · ");
  return '<article class="panel review-card" style="padding:20px;margin-bottom:14px">'+
   '<div style="display:flex;gap:16px;align-items:flex-start">'+(artUrl?'<img src="'+escapeHtml(artUrl)+'" alt="Release artwork" style="width:112px;height:112px;object-fit:cover;border-radius:10px">':'<div class="cover">♫</div>')+
   '<div style="min-width:0;flex:1"><h3>'+escapeHtml(r.title||"Untitled release")+'</h3><p>'+escapeHtml(r.studio_artists?.stage_name||"Artist")+' · '+escapeHtml(r.genre||"Genre missing")+'</p><small>Submitted '+new Date(r.submitted_at||r.created_at).toLocaleString()+'</small></div></div>'+
   (audioUrl?'<div style="margin-top:14px"><audio controls preload="none" src="'+escapeHtml(audioUrl)+'" style="width:100%">Audio preview unavailable in this browser.</audio></div>':'<p class="validation-box">Audio preview unavailable. Approval is disabled until the file can be accessed.</p>')+
   '<div class="review-metadata"><p><b>Language:</b> '+escapeHtml(r.language||"Missing")+' · <b>Release date:</b> '+escapeHtml(r.release_date||"Missing")+' · <b>Explicit:</b> '+escapeHtml(r.explicit_content||"Missing")+'</p><p><b>Credits:</b> '+escapeHtml(credits||"Missing")+'</p><p><b>Label:</b> '+escapeHtml(r.label_name||"Independent / not supplied")+' · <b>ISRC:</b> '+escapeHtml(r.isrc||"Not supplied")+' · <b>UPC:</b> '+escapeHtml(r.upc||"Not supplied")+'</p><p><b>Rights confirmed:</b> '+(r.rights_confirmed?"Yes":"No")+' · <b>Metadata confirmed:</b> '+(r.metadata_confirmed?"Yes":"No")+'</p></div>'+
   '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="primary-button" data-approve="'+r.id+'" '+(canApprove?"":"disabled title=\"Media must be accessible before approval\"")+'>Approve & publish</button><button class="outline-button" data-reject="'+r.id+'">Decline release & notify artist</button></div></article>';
 }));
 $("#review-list").innerHTML=cards.length?cards.join(""):'<div class="panel analytics-empty"><h2>No submissions awaiting review</h2><p>New artist submissions will appear here.</p></div>';
}
function renderArtists(){$("#artist-grid").innerHTML=currentArtist?'<div class="panel analytics-empty"><h2>'+escapeHtml(currentArtist.stage_name)+'</h2><p>Your artist profile is connected.</p></div>':'<div class="panel analytics-empty"><h2>No artist profiles yet</h2><p>Artist profiles appear here after registration.</p></div>'}
function openModal(title,copy){$("#modal-title").textContent=title;$("#modal-copy").textContent=copy;$("#modal-backdrop").classList.add("show")}
$("#modal-close").addEventListener("click",()=>$("#modal-backdrop").classList.remove("show"));$("#modal-ok").addEventListener("click",()=>$("#modal-backdrop").classList.remove("show"));$("#modal-backdrop").addEventListener("click",e=>{if(e.target.id==="modal-backdrop")e.currentTarget.classList.remove("show")});
async function openNotifications(){
  if(!currentUser){openModal("Sign in for notifications","Release updates are linked to your artist account. Sign in to see submission and review activity.");return;}
  const {data,error}=await supabase.from("studio_notifications").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(20);
  if(error){toast("Notifications could not be loaded: "+error.message);return;}
  const items=data||[];
  if(!items.length){openModal("No release updates yet","When an administrator approves or declines one of your releases, the update will appear here.");return;}
  const lines=items.map(n=>(n.title||"Release update")+"\\n"+n.message+" · "+new Date(n.created_at).toLocaleString());
  const unread=items.filter(n=>!n.read_at).map(n=>n.id);
  if(unread.length){await supabase.from("studio_notifications").update({read_at:new Date().toISOString()}).in("id",unread);$("#notifications em").style.display="none";}
  openModal("Release notifications",lines.join("\\n\\n"));
}
async function checkReviewNotifications(){if(!currentUser)return;const {data,error}=await supabase.from("studio_notifications").select("id,title,message,created_at").eq("user_id",currentUser.id).is("read_at",null).order("created_at",{ascending:false}).limit(5);if(error)return;const badge=$("#notifications em");if(badge)badge.style.display=data?.length?"block":"none";if(data?.length){const latest=data[0],seen=localStorage.getItem("afrovibe.last-notification-toast");if(seen!==latest.id){localStorage.setItem("afrovibe.last-notification-toast",latest.id);toast(latest.title+" — "+latest.message);}}}
$("#notifications").addEventListener("click",openNotifications);
$("#profile-menu").addEventListener("click",()=>showPage("artist-profile"));
async function loadCities(country,selectedCity=""){const input=$("#profile-city"),list=$("#profile-city-options");if(!input||!list)return;list.innerHTML="";input.placeholder=country?"Loading city list…":"Choose a country first";input.disabled=!country;if(!country)return;try{const response=await fetch("https://countriesnow.space/api/v0.1/countries/cities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({country})});if(!response.ok)throw new Error("City list unavailable");const result=await response.json(),cities=Array.isArray(result.data)?result.data:[];list.innerHTML=cities.sort((a,b)=>a.localeCompare(b)).map(city=>'<option value="'+escapeHtml(city)+'"></option>').join("");input.placeholder=cities.length?"Choose or type your city":"Enter your city";if(selectedCity)input.value=selectedCity;}catch{input.placeholder="Enter your city (suggestions unavailable)";if(selectedCity)input.value=selectedCity;}}
$("#profile-country").addEventListener("change",()=>{$("#profile-city").value="";void loadCities($("#profile-country").value);});
$("#invite-artist").addEventListener("click",()=>{
 if(!currentUser){showAuthDialog();toast("Sign in before preparing an artist invitation.");return;}
 const email=window.prompt("Enter the artist's email address:");
 if(!email)return;
 const address=email.trim();
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)){toast("Enter a valid email address.");return;}
 const subject=encodeURIComponent("You're invited to AfroVibe Studio");
 const body=encodeURIComponent("Hello,\\n\\nI'd like to invite you to join AfroVibe Studio to create your artist profile and manage your music releases.\\n\\nOpen AfroVibe Studio: https://afrovibez-studio.vercel.app\\n\\nBest regards");
 window.location.href="mailto:"+encodeURIComponent(address)+"?subject="+subject+"&body="+body;
 toast("Invitation email prepared. Send it from your email app to complete the invitation.");
});
function setFile(input,title,subtitle){const files=Array.from(input.files||[]);if(!files.length)return;const max=input.id==="audio-file"?500*1024*1024:15*1024*1024;const audio=/\.(mp3|wav|flac|aiff|aif|m4a|aac|ogg)$/i;const image=/\.(jpg|jpeg|png|webp)$/i;const bad=files.find(f=>!(input.id==="audio-file"?audio:image).test(f.name)||f.size>max);if(bad){toast("Unsupported file format or file too large.");input.value="";return}title.textContent=files.length===1?files[0].name:files.length+" files selected";subtitle.textContent=files.map(f=>f.name+" ("+(f.size/1048576).toFixed(1)+" MB)").join(" · ")}
$("#browse-audio").addEventListener("click",()=>$("#audio-file").click());$("#browse-art").addEventListener("click",()=>$("#art-file").click());$("#browse-profile-photo").addEventListener("click",()=>$("#profile-photo").click());
$("#profile-photo").addEventListener("change",()=>setFile($("#profile-photo"),$("#profile-photo-title"),$("#profile-photo-subtitle")));
$("#audio-file").addEventListener("change",()=>setFile($("#audio-file"),$("#audio-title"),$("#audio-subtitle")));
$("#art-file").addEventListener("change",()=>setFile($("#art-file"),$("#art-title"),$("#art-subtitle")));
["audio-drop","art-drop","profile-photo-drop"].forEach(id=>{const box=$("#"+id);if(!box)return;box.addEventListener("dragover",e=>{e.preventDefault();box.style.borderColor="#2563eb"});box.addEventListener("dragleave",()=>box.style.borderColor="");box.addEventListener("drop",e=>{e.preventDefault();box.style.borderColor="";const file=e.dataTransfer.files[0];if(!file)return;const input=$(id==="audio-drop"?"#audio-file":id==="art-drop"?"#art-file":"#profile-photo");const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event("change"))})});
function addAuthUi(){const top=$(".top-actions");const button=document.createElement("button");button.className="outline-button";button.id="auth-action";button.textContent="Sign in";top.prepend(button);const style=document.createElement("style");style.textContent="#auth-panel{position:fixed;inset:0;background:#10182899;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px}#auth-panel .auth-card{background:white;color:#172033;border-radius:18px;padding:28px;width:min(440px,100%);box-shadow:0 20px 70px #0003}#auth-panel input{width:100%;padding:12px;border:1px solid #d0d5dd;border-radius:9px;margin:7px 0 14px}#auth-panel button{margin:5px 8px 0 0}#auth-panel .auth-row{display:flex;gap:8px;flex-wrap:wrap}";document.head.append(style);const panel=document.createElement("div");panel.id="auth-panel";panel.innerHTML='<div class="auth-card"><h2 id="auth-heading">Artist sign in</h2><p id="auth-copy">Create an account to manage your music releases.</p><label>Email<input id="auth-email" type="email" autocomplete="email" required></label><label>Password<input id="auth-password" type="password" minlength="8" autocomplete="current-password" required></label><div class="auth-row"><button class="primary-button" id="auth-submit">Sign in</button><button class="outline-button" id="auth-toggle">Create account</button><button class="outline-button" id="auth-cancel">Cancel</button></div></div>';document.body.append(panel);$("#auth-action").addEventListener("click",()=>currentUser?signOut():showAuthDialog());$("#auth-cancel").addEventListener("click",()=>panel.style.display="none");$("#auth-toggle").addEventListener("click",()=>{const signup=$("#auth-submit").dataset.mode!=="signup";$("#auth-submit").dataset.mode=signup?"signup":"signin";$("#auth-submit").textContent=signup?"Create account":"Sign in";$("#auth-heading").textContent=signup?"Create your artist account":"Artist sign in";$("#auth-copy").textContent=signup?"Use your email and a password of at least 8 characters.":"Sign in to your AfroVibe Studio account."});$("#auth-submit").addEventListener("click",handleAuth)}
function showAuthDialog(){if(!currentUser){$("#auth-panel").style.display="flex";$("#auth-submit").dataset.mode="signin";$("#auth-submit").textContent="Sign in"}}
async function handleAuth(){if(!supabase){toast("Secure connection is unavailable. Please try again shortly.");return;}const email=$("#auth-email").value.trim();const password=$("#auth-password").value;if(!email||password.length<8){toast("Enter a valid email and a password of at least 8 characters.");return}const signup=$("#auth-submit").dataset.mode==="signup";$("#auth-submit").disabled=true;try{const result=signup?await supabase.auth.signUp({email,password,options:{data:{display_name:email.split("@")[0]},emailRedirectTo:"https://afrovibez-studio.vercel.app/"}}):await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;if(signup&&!result.data.session){toast("Account created. Check your email to confirm it, then sign in.");$("#auth-panel").style.display="none"}else{$("#auth-panel").style.display="none";await loadAccount();toast(signup?"Artist account created.":"Welcome back.")}}catch(e){toast(e.message||"Authentication failed.")}finally{$("#auth-submit").disabled=false}}
async function signOut(){if(!supabase){toast("Secure connection is unavailable.");return;}await supabase.auth.signOut();currentUser=null;currentArtist=null;currentRole="artist";releases=[];$("#auth-action").textContent="Sign in";renderAll();renderArtists();toast("Signed out.")}
async function loadAccount(){const {data:{user}}=await supabase.auth.getUser();currentUser=user;if(!user){currentRole="artist";$("#auth-action").textContent="Sign in";return}$("#auth-action").textContent="Sign out";const {data:profile,error:profileError}=await supabase.from("studio_profiles").select("role").eq("id",user.id).maybeSingle();if(profileError)throw profileError;currentRole=profile?.role||"artist";const {data,error}=await supabase.from("studio_artists").select("*").eq("owner_user_id",user.id).maybeSingle();if(error)throw error;currentArtist=data;renderArtists();await renderReview();if(data){await loadReleases();if(!releases.length)showPage("upload");$("#artist-name").value=data.stage_name||"";$("#profile-stage-name").value=data.stage_name||"";$("#profile-bio").value=data.bio||"";$("#profile-country").value=data.country||"";$("#profile-city").value=data.city||"";void loadCities(data.country||"",data.city||"");$("#profile-language").value=data.primary_language||"";$("#profile-artist-type").value=data.artist_type||"";$("#profile-city").value=data.city||"";$("#profile-contact").value=data.contact_email||"";$("#profile-legal-name").value=data.legal_name||"";$("#profile-website").value=data.website||"";$("#profile-instagram").value=data.instagram||"";$("#profile-tiktok").value=data.tiktok||"";$("#profile-youtube").value=data.youtube||"";$("#profile-facebook").value=data.facebook||"";$("#profile-music-link").value=data.music_link||"";$("#profile-management").value=data.management||"";$("#artist-name").value=data.stage_name||""}else{releases=[];renderAll();showPage("artist-profile");toast("Welcome to AfroVibe Studio. Complete your artist profile before uploading music.");}}
function showValidation(id,items){const box=$("#"+id);if(!box)return;if(!items.length){box.hidden=true;box.innerHTML="";return;}box.hidden=false;box.innerHTML='<strong>Please complete these required items:</strong><ul>'+items.map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ul>';}
async function saveArtistProfile(){
 if(!currentUser){showAuthDialog();toast("Sign in or create an artist account first.");return;}
 const stage=$("#profile-stage-name").value.trim(),bio=$("#profile-bio").value.trim(),type=$("#profile-artist-type").value,country=$("#profile-country").value.trim(),city=$("#profile-city").value.trim(),email=$("#profile-contact").value.trim(),photo=$("#profile-photo").files[0];
 const missing=[];
 if(!stage)missing.push("Artist / stage name");if(!type)missing.push("Artist type");if(!country)missing.push("Country");if(!city)missing.push("City");if(!bio)missing.push("Artist biography");
 if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))missing.push("Valid professional contact email");
 if(!photo&&!currentArtist?.avatar_path)missing.push("Artist profile photo");
 if(!$("#profile-consent").checked)missing.push("Profile photo and information permission confirmation");
 if(missing.length){showValidation("profile-validation",missing);toast("Your artist profile is not complete yet.");return;}
 showValidation("profile-validation",[]);
 if(photo&&(!/^image\/(jpeg|png|webp)$/.test(photo.type)||photo.size>15*1024*1024)){showValidation("profile-validation",["Profile photo must be JPG, PNG or WEBP and no larger than 15 MB."]);return;}
 let avatar_path=currentArtist?.avatar_path||null,uploadedPhotoPath=null;
 if(photo){const safeName=photo.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=currentUser.id+"/"+crypto.randomUUID()+"-"+safeName;const {error}=await supabase.storage.from("studio-artwork").upload(path,photo,{upsert:false});if(error)throw error;avatar_path=path;uploadedPhotoPath=path;}
 const payload={owner_user_id:currentUser.id,stage_name:stage,legal_name:$("#profile-legal-name").value.trim(),artist_type:type,country,city,primary_language:$("#profile-language").value.trim(),bio,avatar_path,website:$("#profile-website").value.trim(),instagram:$("#profile-instagram").value.trim(),tiktok:$("#profile-tiktok").value.trim(),youtube:$("#profile-youtube").value.trim(),facebook:$("#profile-facebook").value.trim(),music_link:$("#profile-music-link").value.trim(),management:$("#profile-management").value.trim(),contact_email:email,profile_consent:true,profile_consent_at:new Date().toISOString()};
 const {data,error}=await supabase.from("studio_artists").upsert(payload,{onConflict:"owner_user_id"}).select().single();
  if(error||!data){if(uploadedPhotoPath)await supabase.storage.from("studio-artwork").remove([uploadedPhotoPath]);throw error||new Error("The database did not confirm that your artist profile was saved.");}
 if(error){if(uploadedPhotoPath)await supabase.storage.from("studio-artwork").remove([uploadedPhotoPath]);throw error;}
 const previousAvatar=currentArtist?.avatar_path;currentArtist=data;$("#artist-name").value=stage;renderArtists();if(previousAvatar&&previousAvatar!==avatar_path){try{await supabase.storage.from("studio-artwork").remove([previousAvatar]);}catch(err){console.warn("Old profile image cleanup deferred",err);}}$("#profile-photo").value="";$("#profile-photo-title").textContent="Artist profile photo saved";$("#profile-photo-subtitle").textContent="Your photo is securely saved.";toast("Artist profile saved. Taking you to Upload Music…");showPage("upload");
}
$("#save-artist-profile").addEventListener("click",async()=>{try{await saveArtistProfile()}catch(e){toast(e.message||"Could not save artist profile.")}});
async function submitRelease(asDraft){
 if(!currentUser){showAuthDialog();toast("Sign in to save or submit a release.");return;}
 if(!currentArtist){showPage("artist-profile");toast("Complete and save your artist profile first.");return;}
 const existingRelease=editingReleaseId?releases.find(r=>r.id===editingReleaseId):null;
 const audio=$("#audio-file").files[0]||null,artwork=$("#art-file").files[0]||null,title=$("#track-title").value.trim(),genre=$("#genre").value,language=$("#language").value.trim(),releaseDate=$("#release-date").value,explicit=$("#explicit").value;
 const missing=[];
 if(!asDraft){
  if(!currentArtist.stage_name||!currentArtist.artist_type||!currentArtist.country||!currentArtist.city||!currentArtist.bio||!currentArtist.avatar_path||!currentArtist.contact_email)missing.push("Complete all required artist profile details first.");
  if(!title)missing.push("Release title");if(!genre)missing.push("Genre");if(!$("#release-type").value)missing.push("Release type");if(!language)missing.push("Language");if(!releaseDate)missing.push("Release date");if(!explicit)missing.push("Explicit-content classification");if(!audio&&!existingRelease?.audio_path)missing.push("Audio file");if(!artwork&&!existingRelease?.artwork_path)missing.push("Cover artwork");if(!$("#rights-check").checked)missing.push("Confirm that you own or have permission to distribute the audio and artwork");if(!$("#metadata-check").checked)missing.push("Confirm that all release metadata is accurate");if($("#release-type").value!=="Single")missing.push("Only Single releases are currently supported; multi-track releases are not enabled yet");
 }
 showValidation("release-validation",missing);if(missing.length){toast("Submission blocked. Complete every required item.");return;}
 const audioExt=audio?audio.name.split(".").pop().toLowerCase():"",artExt=artwork?artwork.name.split(".").pop().toLowerCase():"",allowedAudio=["mp3","wav","flac","aiff","aif","m4a","aac","ogg"],allowedArt=["jpg","jpeg","png","webp"];
 if(audio&&(!allowedAudio.includes(audioExt)||audio.size===0||audio.size>500*1024*1024)){showValidation("release-validation",["Audio must be a non-empty MP3, WAV, FLAC, AIFF, M4A, AAC or OGG file no larger than 500 MB."]);return;}
 if(artwork&&(!allowedArt.includes(artExt)||artwork.size===0||artwork.size>15*1024*1024)){showValidation("release-validation",["Artwork must be a non-empty JPG, PNG or WEBP image no larger than 15 MB."]);return;}
 const button=asDraft?$("#save-draft"):$("#submit-release"),originalText=button.textContent;button.disabled=true;button.textContent=asDraft?"Saving draft…":"Uploading and submitting…";
 let audioPath=null,artPath=null;
 try{
  if(audio){const safeName=audio.name.replace(/[^a-zA-Z0-9._-]/g,"_");audioPath=currentArtist.id+"/"+crypto.randomUUID()+"-"+safeName;const up=await supabase.storage.from("studio-audio").upload(audioPath,audio,{upsert:false});if(up.error)throw up.error;}
  if(artwork){const safeName=artwork.name.replace(/[^a-zA-Z0-9._-]/g,"_");artPath=currentArtist.id+"/"+crypto.randomUUID()+"-"+safeName;const up=await supabase.storage.from("studio-artwork").upload(artPath,artwork,{upsert:false});if(up.error)throw up.error;}
  const payload={artist_id:currentArtist.id,title:title||null,genre:genre||null,release_type:$("#release-type").value||"Single",language:language||null,featured_artists:$("#featured-artists").value.trim()||null,producers:$("#producers").value.trim()||null,songwriters:$("#songwriters").value.trim()||null,composers:$("#composers").value.trim()||null,label_name:$("#label-name").value.trim()||null,release_date:releaseDate||null,explicit_content:explicit||null,isrc:$("#isrc").value.trim()||null,upc:$("#upc").value.trim()||null,lyrics:$("#lyrics").value.trim()||null,description:$("#description").value.trim()||null,audio_path:audioPath||existingRelease?.audio_path||null,artwork_path:artPath||existingRelease?.artwork_path||null,audio_filename:audio?.name||existingRelease?.audio_filename||null,status:asDraft?"draft":"pending",submitted_at:asDraft?null:new Date().toISOString(),rights_confirmed:!asDraft&&$("#rights-check").checked,metadata_confirmed:!asDraft&&$("#metadata-check").checked,rights_confirmed_at:!asDraft&&$("#rights-check").checked?new Date().toISOString():null,metadata_confirmed_at:!asDraft&&$("#metadata-check").checked?new Date().toISOString():null};
  const savedResult=editingReleaseId
   ? await supabase.from("studio_tracks").update(payload).eq("id",editingReleaseId).select().single()
   : await supabase.from("studio_tracks").insert(payload).select().single();
  if(savedResult.error)throw savedResult.error;
  if(existingRelease&&audioPath&&existingRelease.audio_path){try{await supabase.storage.from("studio-audio").remove([existingRelease.audio_path]);}catch(err){console.warn("Old audio cleanup deferred",err);}}
  if(existingRelease&&artPath&&existingRelease.artwork_path){try{await supabase.storage.from("studio-artwork").remove([existingRelease.artwork_path]);}catch(err){console.warn("Old artwork cleanup deferred",err);}}
  editingReleaseId=asDraft?savedResult.data.id:null;
  await loadReleases();showValidation("release-validation",[]);
  $("#save-draft").textContent=editingReleaseId?"Update draft":"Save draft";
  $("#submit-release").textContent=editingReleaseId?"Update and submit for review →":"Submit for review →";
  toast(asDraft?"Draft saved. You can reopen it from My releases to continue.":"Release submitted for administrator review. It is not public until approved.");
  if(!asDraft){$("#audio-file").value="";$("#art-file").value="";$("#audio-title").textContent="Drop your audio file here";$("#art-title").textContent="Upload your own cover artwork";$("#track-title").value="";$("#genre").value="";$("#language").value="";$("#release-date").value="";$("#explicit").value="";$("#featured-artists").value="";$("#producers").value="";$("#songwriters").value="";$("#composers").value="";$("#label-name").value="";$("#isrc").value="";$("#upc").value="";$("#lyrics").value="";$("#description").value="";$("#rights-check").checked=false;$("#metadata-check").checked=false;$("#save-draft").textContent="Save draft";$("#submit-release").textContent="Submit for review →";editingReleaseId=null;showPage("releases");}
 }catch(e){if(audioPath)await supabase.storage.from("studio-audio").remove([audioPath]);if(artPath)await supabase.storage.from("studio-artwork").remove([artPath]);toast(e.message||"Release could not be saved. Please correct the details and retry.");}
 finally{button.disabled=false;button.textContent=originalText;}
}
$("#submit-release").addEventListener("click",()=>submitRelease(false));$("#save-draft").addEventListener("click",()=>submitRelease(true));
let createSupabaseClient = null;
async function loadSupabaseLibrary(){
 if(createSupabaseClient)return;
 const sources=[
  "https://esm.sh/@supabase/supabase-js@2.117.2",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm",
  "https://esm.sh/@supabase/supabase-js@2"
 ];
 const failures=[];
 for(const source of sources){
  try{
   const module=await import(source);
   if(typeof module.createClient!=="function")throw new Error("The downloaded module did not expose createClient.");
   createSupabaseClient=module.createClient;
   return;
  }catch(error){failures.push(source+": "+(error?.message||String(error)));}
 }
 throw new Error("AfroVibe Studio could not load the Supabase browser SDK from its module CDNs. This is a library-download failure, not proof that your Supabase project or account is unavailable. Check whether your network, browser content blocker or DNS blocks esm.sh/jsDelivr, then retry. Details: "+failures.join(" | "));
}
async function boot(){
 addAuthUi();
 try{await loadSupabaseLibrary();supabase=createSupabaseClient(SUPABASE_URL,SUPABASE_ANON_KEY);}
 catch(e){toast(e.message||"Secure connection unavailable. Navigation is still available.");return;}
 supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;$("#auth-action").textContent=currentUser?"Sign out":"Sign in";if(currentUser)queueMicrotask(()=>loadAccount().catch(e=>toast(e.message)));else{currentArtist=null;currentRole="artist";releases=[];renderAll();renderArtists();renderReview()}});
 try{await loadAccount()}catch(e){toast(e.message||"Could not load your Studio account.")}
}
$("#review-list").addEventListener("click",async e=>{const approve=e.target.closest("[data-approve]");const reject=e.target.closest("[data-reject]");const id=approve?.dataset.approve||reject?.dataset.reject;if(!id||currentRole!=="admin")return;const isApprove=!!approve;const note=isApprove?"":(window.prompt("What changes are required?")||"");if(!isApprove&&!note.trim())return;const update={status:isApprove?"approved":"rejected",reviewed_at:new Date().toISOString(),reviewed_by:currentUser.id,review_note:isApprove?null:note,approved_at:isApprove?new Date().toISOString():null};const {error}=await supabase.from("studio_tracks").update(update).eq("id",id);if(error){toast(error.message);return}toast(isApprove?"Release approved and artist notified.":"Release declined and artist notified.");await renderReview()});renderAll();renderArtists();renderReview();boot().catch(e=>toast(e.message||"Studio could not start. Please refresh the page."));