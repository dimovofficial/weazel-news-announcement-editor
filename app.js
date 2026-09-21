const APPS_SCRIPT="https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";
const state={items:[],query:"",category:"",open:null,total:0,categories:[]};
const sections=document.getElementById("sections"),search=document.getElementById("search"),count=document.getElementById("count"),status=document.getElementById("status"),toast=document.getElementById("toast"),categories=document.getElementById("categories");

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=x=>[x.sheetName,x.row,x.column].join(":");

function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),1200)}
async function copy(t){try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}notify("Скопировано")}

function renderCategories(){
  categories.innerHTML="";
  const groups=[
    {title:"ОСНОВНЫЕ",names:state.categories.filter(x=>!["Кодовые","Отклонения","Шаблоны"].includes(x))},
    {title:"СЛУЖЕБНЫЕ",names:state.categories.filter(x=>["Кодовые","Отклонения","Шаблоны"].includes(x))}
  ];
  groups.forEach(group=>{
    if(!group.names.length)return;
    const wrap=document.createElement("div");wrap.className="category-group";
    const title=document.createElement("div");title.className="category-group-title";title.textContent=group.title;wrap.appendChild(title);
    const row=document.createElement("div");row.className="category-row";
    group.names.forEach(name=>{
      const b=document.createElement("button");
      b.type="button";b.className="category"+(name===state.category?" active":"");b.textContent=name;
      b.onclick=()=>{if(name===state.category)return;state.category=name;state.query="";state.open=null;search.value="";renderCategories();load()};
      row.appendChild(b);
    });
    wrap.appendChild(row);categories.appendChild(wrap);
  });
}

function jsonp(params){
  return new Promise((resolve,reject)=>{
    const callback="wnEditor_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script"),url=new URL(APPS_SCRIPT);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("prefix",callback);
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;delete window[callback];script.remove();clearTimeout(timer);fn(value)};
    window[callback]=data=>finish(resolve,data);
    script.onerror=()=>finish(reject,new Error("JSONP error"));
    const timer=setTimeout(()=>finish(reject,new Error("JSONP timeout")),20000);
    script.src=url.toString();document.head.appendChild(script);
  });
}

async function request(params){
  const qs=new URLSearchParams(params).toString();
  let data=null;
  try{
    const r=await fetch("/api/editor?"+qs,{cache:"no-store",headers:{Accept:"application/json"}});
    if(r.ok){const text=await r.text();try{data=JSON.parse(text)}catch{}}
  }catch{}
  if(data&&data.ok)return data;
  const fallback=await jsonp(params);
  if(!fallback||!fallback.ok)throw Error(fallback&&fallback.error||"Apps Script API error");
  return fallback;
}

async function loadCategories(){
  const data=await request({action:"categories"});
  state.categories=Array.isArray(data.categories)?data.categories:[];
  if(!state.categories.length)throw Error("Категории не найдены");
  if(!state.category||!state.categories.includes(state.category))state.category=state.categories[0];
  renderCategories();
}

async function load(){
  status.classList.remove("ok");
  status.innerHTML="<i></i> Загрузка "+esc(state.category);
  try{
    const q=search.value.trim();
    const data=await request({action:"category",category:state.category,...(q?{q}:{})});
    state.items=Array.isArray(data.items)?data.items:[];
    state.total=Number(data.categoryTotal||data.total||state.items.length);
    status.classList.add("ok");
    status.innerHTML="<i></i> Данные синхронизированы";
    render();
  }catch(e){
    status.classList.remove("ok");
    status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось загрузить данные.<br><small style="display:block;margin-top:10px;color:#555">Проверьте публикацию Apps Script и доступ к таблице.</small></div>';
    console.error("Editor API:",e);
  }
}

function render(){
  const q=state.query.trim();
  count.textContent=q?state.items.length+" результатов"+(state.total>state.items.length?" из "+state.total:""):state.total+" позиций";
  sections.innerHTML="";
  if(!state.items.length){
    sections.innerHTML='<div class="empty">'+(q?"Ничего не найдено в категории «"+esc(state.category)+"».":"В категории пока нет заполненных данных.")+'</div>';
    return;
  }
  const sec=document.createElement("section");sec.className="section";
  sec.innerHTML='<div class="sectionhead"><h2>'+esc(state.category)+'</h2><span>'+state.items.length+" ПОЗИЦИЙ</span></div>";
  const box=document.createElement("div");box.className="items";
  for(const item of state.items){
    const options=Array.isArray(item.options)?item.options:[];
    const has=options.length>1;
    const b=document.createElement("button");
    b.type="button";b.className="item"+(has?" hasoptions":"");
    b.innerHTML="<span>"+esc(item.value)+"</span>"+(has?"<small>выбрать вариант</small>":"");
    b.onclick=async()=>{
      if(!has){if(item.copyable!==false)await copy(item.value);return}
      state.open=state.open===key(item)?null:key(item);render();
    };
    box.appendChild(b);
    if(state.open===key(item)){
      const choices=document.createElement("div");choices.className="choices";
      options.forEach(option=>{
        const c=document.createElement("button");c.type="button";c.className="choice";c.textContent=option;
        c.onclick=async e=>{e.stopPropagation();await copy(option);state.open=null;render()};
        choices.appendChild(c);
      });
      box.appendChild(choices);
    }
  }
  sec.appendChild(box);sections.appendChild(sec);
}

let searchTimer;
search.addEventListener("input",()=>{
  state.query=search.value;state.open=null;clearTimeout(searchTimer);searchTimer=setTimeout(load,250);
});

(async()=>{
  try{await loadCategories();await load()}
  catch(e){
    status.classList.remove("ok");status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось получить список разделов из Google Sheets.</div>';
    console.error("Editor bootstrap:",e);
  }
})();
