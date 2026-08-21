import React,{useEffect,useRef,useState} from "react";
import axios from "axios";
import {io} from "socket.io-client";
import {Search,Send,LogOut,MessageCircle,Check,CheckCheck,ArrowLeft} from "lucide-react";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000";
const api=axios.create({baseURL:API});
function setAuth(t){api.defaults.headers.common.Authorization=`Bearer ${t}`}

export default function App(){
 const [token,setToken]=useState(localStorage.getItem("token"));
 const [me,setMe]=useState(null);
 const [authMode,setAuthMode]=useState("login");
 const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [searchEmail,setSearchEmail]=useState(""); const [found,setFound]=useState(null);
 const [chat,setChat]=useState(null); const [messages,setMessages]=useState([]); const [text,setText]=useState("");
 const [typing,setTyping]=useState(false); const [online,setOnline]=useState(false);
 const socketRef=useRef(null); const bottom=useRef(null); const typingTimer=useRef(null);

 useEffect(()=>{ if(token){setAuth(token); api.get("/api/auth/me").then(r=>setMe(r.data.user)).catch(()=>logout())}},[token]);
 useEffect(()=>{
  if(!token)return;
  const s=io(API,{auth:{token}}); socketRef.current=s;
  s.on("message:new",m=>{if(chat?.id===m.sender) setMessages(x=>[...x,m])});
  s.on("message:sent",m=>{if(chat?.id===m.receiver) setMessages(x=>[...x,m])});
  s.on("typing",d=>{if(chat?.id===d.userId)setTyping(true)});
  s.on("stopTyping",d=>{if(chat?.id===d.userId)setTyping(false)});
  s.on("presence",d=>{if(chat?.id===d.userId)setOnline(d.online)});
  return()=>s.disconnect();
 },[token,chat?.id]);
 useEffect(()=>bottom.current?.scrollIntoView({behavior:"smooth"}),[messages,typing]);

 async function submitAuth(e){
  e.preventDefault();
  try{
   const url=authMode==="login"?"/api/auth/login":"/api/auth/register";
   const r=await api.post(url,{name,email,password});
   localStorage.setItem("token",r.data.token); setToken(r.data.token); setMe(r.data.user);
  }catch(e){alert(e.response?.data?.message||"Something went wrong")}
 }
 async function search(){
  try{const r=await api.get(`/api/users/search?email=${encodeURIComponent(searchEmail)}`);setFound(r.data.user)}
  catch(e){alert("Search failed")}
 }
 async function openChat(u){
  setChat(u);setFound(null);setSearchEmail("");setOnline(!!u.online);
  const r=await api.get(`/api/messages/${u.id}`);setMessages(r.data.messages);
 }
 async function send(){
  if(!text.trim()||!chat)return;
  const body=text;setText("");socketRef.current?.emit("stopTyping",{receiver:chat.id});
  try{await api.post("/api/messages",{receiver:chat.id,text:body})}catch(e){alert("Message failed")}
 }
 function handleTyping(e){
  setText(e.target.value);
  if(chat){
   socketRef.current?.emit("typing",{receiver:chat.id});
   clearTimeout(typingTimer.current);
   typingTimer.current=setTimeout(()=>socketRef.current?.emit("stopTyping",{receiver:chat.id}),900);
  }
 }
 function logout(){localStorage.removeItem("token");setToken(null);setMe(null);setChat(null)}

 if(!token||!me) return <Auth mode={authMode} setMode={setAuthMode} name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} submit={submitAuth}/>;

 return <div className="app">
  <aside className={chat?"sidebar mobile-hide": "sidebar"}>
   <header><div className="brand"><MessageCircle/> ChatApp</div><button onClick={logout} title="Logout"><LogOut size={19}/></button></header>
   <div className="me"><div className="avatar">{me.name[0]?.toUpperCase()}</div><div><b>{me.name}</b><small>{me.email}</small></div></div>
   <div className="search"><Search size={18}/><input placeholder="Search by exact email..." value={searchEmail} onChange={e=>setSearchEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}/><button onClick={search}>Find</button></div>
   {found&&<div className="found" onClick={()=>openChat(found)}><div className="avatar">{found.name[0]}</div><div><b>{found.name}</b><small>{found.email}</small></div></div>}
   {!found&&<div className="empty-side"><MessageCircle size={42}/><p>Search someone's email to start a direct chat.</p></div>}
  </aside>
  <main className={chat?"chat":"chat no-chat"}>
   {!chat?<div className="welcome"><MessageCircle size={65}/><h1>ChatApp</h1><p>Search a user's exact email and message them directly.</p></div>:
   <>
    <header className="chat-head"><button className="back" onClick={()=>setChat(null)}><ArrowLeft/></button><div className="avatar">{chat.name[0]}</div><div><b>{chat.name}</b><small>{typing?"typing…":online?"online":"offline"}</small></div></header>
    <section className="messages">{messages.map(m=><div key={m._id} className={"bubble "+(m.sender===me.id||m.sender? (String(m.sender)===String(me.id)?"mine":"theirs"):"")}><span>{m.text}</span><small>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} {String(m.sender)===String(me.id)&&(m.read?<CheckCheck size={14}/>:<Check size={14}/>)}</small></div>)}<div ref={bottom}/></section>
    <div className="composer"><input value={text} onChange={handleTyping} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Type a message"/><button onClick={send}><Send size={20}/></button></div>
   </>}
  </main>
 </div>
}

function Auth({mode,setMode,name,setName,email,setEmail,password,setPassword,submit}){
 return <div className="auth"><form onSubmit={submit}><div className="logo"><MessageCircle size={48}/></div><h1>ChatApp</h1><p>WhatsApp-style direct messaging by email</p>{mode==="register"&&<input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} required/>}<input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password (6+ characters)" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary">{mode==="login"?"Login":"Create account"}</button><button type="button" className="switch" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Create a new account":"Already have an account? Login"}</button></form></div>
}
