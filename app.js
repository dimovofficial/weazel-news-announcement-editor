const state={items:[],query:"",open:null};
const sections=document.getElementById("sections"),search=document.getElementById("search"),count=document.getElementById("count"),status=document.getElementById("status"),toast=document.getElementById("toast");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=x=>[x.sheetName,x.row,x.column].join(":");
function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),1200)}
async function copy(t){try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}notify("Скопировано")}
async function load(){
  try{
    const r=await fetch("/api/editor?action=index",{cache:"no-store",headers:{Accept:"application/json"}});
    const text=await r.text();
    let d;
    try{d=JSON.parse(text)}catch{throw Error("API вернул не JSON: "+text.slice(0,180))}
    if(!r.ok||!d.ok)throw Error(d.error||("HTTP "+r.status));
    state.items=d.items||[];
    status.classList.add("ok");
    status.innerHTML="<i></i> Данные синхронизированы";
    render();
  }catch(e){
    status.classList.remove("ok");
    status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось загрузить данные.<br><small style="display:block;margin-top:10px;color:#555">API редактора не отвечает. Обновите страницу через несколько секунд.</small></div>';
    console.error("Editor API:",e);
  }
}
function render(){
  const q=state.query.trim().toLowerCase();
  const list=q?state.items.filter(x=>[x.sheetName,x.value,...(x.options||[])].join(" ").toLowerCase().includes(q)).slice(0,30):state.items;
  count.textContent=q?list.length+" результатов":state.items.length+" позиций";
  const groups=new Map();list.forEach(x=>{if(!groups.has(x.sheetName))groups.set(x.sheetName,[]);groups.get(x.sheetName).push(x)});
  sections.innerHTML="";
  if(!groups.size){sections.innerHTML='<div class="empty">Ничего не найдено.</div>';return}
  for(const [name,items] of groups){
    const sec=document.createElement("section");sec.className="section";
    sec.innerHTML='<div class="sectionhead"><h2>'+esc(name)+'</h2><span>'+items.length+" ПОЗИЦИЙ</span></div>";
    const box=document.createElement("div");box.className="items";
    for(const item of items){
      const b=document.createElement("button");const has=(item.options||[]).length>1;
      b.className="item"+(has?" hasoptions":"");
      b.innerHTML="<span>"+esc(item.value)+"</span>"+(has?"<small>выбрать шаблон</small>":"");
      b.onclick=async()=>{if(!has){await copy(item.value);return}state.open=state.open===key(item)?null:key(item);render()};
      box.appendChild(b);
      if(state.open===key(item)){
        const choices=document.createElement("div");choices.className="choices";
        for(const option of item.options||[]){const c=document.createElement("button");c.className="choice";c.textContent=option;c.onclick=async e=>{e.stopPropagation();await copy(option);state.open=null;render()};choices.appendChild(c)}
        box.appendChild(choices);
      }
    }
    sec.appendChild(box);sections.appendChild(sec);
  }
}
search.addEventListener("input",e=>{state.query=e.target.value;state.open=null;render()});
load();setInterval(load,30000);
