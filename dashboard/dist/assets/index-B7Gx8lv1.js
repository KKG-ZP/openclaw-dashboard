const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/charts-manager-ESgEbMse.js","assets/chart-CL1Ss0PZ.js"])))=>i.map(i=>d[i]);
(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const n of a.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function e(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(s){if(s.ep)return;s.ep=!0;const a=e(s);fetch(s.href,a)}})();const Ft="modulepreload",Ut=function(y){return"/"+y},pt={},L=function(t,e,i){let s=Promise.resolve();if(e&&e.length>0){let r=function(m){return Promise.all(m.map(x=>Promise.resolve(x).then(c=>({status:"fulfilled",value:c}),c=>({status:"rejected",reason:c}))))};document.getElementsByTagName("link");const n=document.querySelector("meta[property=csp-nonce]"),l=n?.nonce||n?.getAttribute("nonce");s=r(e.map(m=>{if(m=Ut(m),m in pt)return;pt[m]=!0;const x=m.endsWith(".css"),c=x?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${m}"]${c}`))return;const d=document.createElement("link");if(d.rel=x?"stylesheet":Ft,x||(d.as="script"),d.crossOrigin="",d.href=m,l&&d.setAttribute("nonce",l),document.head.appendChild(d),x)return new Promise((u,f)=>{d.addEventListener("load",u),d.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${m}`)))})}))}function a(n){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=n,window.dispatchEvent(l),!l.defaultPrevented)throw n}return s.then(n=>{for(const l of n||[])l.status==="rejected"&&a(l.reason);return t().catch(a)})};class Ot{constructor(){this._listeners=new Map}on(t,e){return this._listeners.has(t)||this._listeners.set(t,new Set),this._listeners.get(t).add(e),()=>this.off(t,e)}once(t,e){const i=(...s)=>{this.off(t,i),e(...s)};return this.on(t,i)}off(t,e){const i=this._listeners.get(t);i&&(i.delete(e),i.size===0&&this._listeners.delete(t))}emit(t,...e){const i=this._listeners.get(t);if(i)for(const s of i)try{s(...e)}catch(a){console.error(`[EventBus] Error in handler for "${t}":`,a)}}clear(){this._listeners.clear()}}const I=new Ot;class st{#t=[];addListener(t,e,i,s){t.addEventListener(e,i,s),this.#t.push(()=>t.removeEventListener(e,i,s))}addInterval(t,e){const i=setInterval(t,e);return this.#t.push(()=>clearInterval(i)),i}addTimeout(t,e){const i=setTimeout(t,e);return this.#t.push(()=>clearTimeout(i)),i}addObserver(t){return this.#t.push(()=>t.disconnect()),t}addCleanup(t){this.#t.push(t)}dispose(){for(const t of this.#t)try{t()}catch(e){console.error("[Disposable] cleanup error:",e)}this.#t.length=0}}class qt extends st{constructor(){super(),this.ws=null,this._reconnectTimer=null}connect(){this._cleanup();const t=window.location.protocol==="https:"?"wss:":"ws:",e=window.location.pathname.startsWith("/toolbox/dashboard")?"/toolbox/dashboard/ws":"/ws",i=`${t}//${window.location.host}${e}`;try{this.ws=new WebSocket(i),this.ws.onopen=()=>{I.emit("ws:status","connected")},this.ws.onmessage=s=>{try{const a=JSON.parse(s.data);I.emit("ws:message",a)}catch(a){console.error("解析WebSocket消息失败:",a)}},this.ws.onerror=()=>{I.emit("ws:status","error")},this.ws.onclose=()=>{I.emit("ws:status","disconnected"),this._scheduleReconnect()}}catch(s){console.error("创建WebSocket连接失败:",s),I.emit("ws:status","error")}}_scheduleReconnect(){this._reconnectTimer!=null&&clearTimeout(this._reconnectTimer),this._reconnectTimer=setTimeout(()=>{this._reconnectTimer=null,(!this.ws||this.ws.readyState===WebSocket.CLOSED)&&this.connect()},5e3)}_cleanup(){this._reconnectTimer!=null&&(clearTimeout(this._reconnectTimer),this._reconnectTimer=null),this.ws&&(this.ws.onopen=null,this.ws.onmessage=null,this.ws.onerror=null,this.ws.onclose=null,(this.ws.readyState===WebSocket.OPEN||this.ws.readyState===WebSocket.CONNECTING)&&this.ws.close(),this.ws=null)}get isConnected(){return this.ws&&this.ws.readyState===WebSocket.OPEN}dispose(){this._cleanup(),super.dispose()}}const Vt=8e3;async function H(y,t={}){const{timeout:e=Vt,...i}=t,s=new AbortController,a=setTimeout(()=>s.abort(),e);try{const n=await fetch(y,{signal:s.signal,...i});if(!n.ok)throw new Error(`HTTP ${n.status}`);return await n.json()}finally{clearTimeout(a)}}async function Wt(y){return H(`/api/actions/${y}`,{method:"POST",headers:{"Content-Type":"application/json"}})}const Gt={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Kt=/[&<>"']/g;function g(y){return typeof y!="string"?"":y.replace(Kt,t=>Gt[t])}function gt(y){const t=new Date(y),i=new Date-t,s=Math.floor(i/6e4),a=Math.floor(i/36e5),n=Math.floor(i/864e5);return s<1?"刚刚":s<60?`${s}分钟前`:a<24?`${a}小时前`:n<7?`${n}天前`:t.toLocaleDateString("zh-CN")}function $(y){const t=Number(y)||0;return t>=1e9?`${(t/1e9).toFixed(1)}B`:t>=1e6?`${(t/1e6).toFixed(1)}M`:t>=1e3?`${(t/1e3).toFixed(1)}K`:`${t}`}class Jt extends st{constructor(){super(),this.notifications=[],this.unreadCount=0,this.currentFilter="all",this._panelEl=null,this._btnEl=null}init(){this.setupUI(),this.loadNotifications(),this.setupEventListeners(),this.requestPermission(),this.renderNotifications()}async requestPermission(){"Notification"in window&&Notification.permission==="default"&&await Notification.requestPermission()}setupUI(){const t=document.querySelector(".header-right");t&&(this._btnEl=document.createElement("div"),this._btnEl.className="notification-btn",this._btnEl.id="notificationBtn",this._btnEl.innerHTML=`
      <span class="notification-icon">🔔</span>
      <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
    `,this._panelEl=document.createElement("div"),this._panelEl.className="notification-panel hidden",this._panelEl.id="notificationPanel",this._panelEl.style.display="none",this._panelEl.innerHTML=`
      <div class="notification-header">
        <h3>通知中心</h3>
        <button class="notification-close" id="closeNotificationPanel">&times;</button>
      </div>
      <div style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="btn-small notif-filter-btn" data-filter="all">全部</button>
        <button class="btn-small notif-filter-btn" data-filter="unread">未读</button>
        <button class="btn-small notif-filter-btn" data-filter="read">已读</button>
      </div>
      <div class="notification-list" id="notificationList">
        <div class="empty-state">暂无通知</div>
      </div>
      <div class="notification-footer">
        <button class="btn-small" id="markAllRead">全部标记为已读</button>
        <button class="btn-small" id="deleteReadNotifications">删除已读</button>
        <button class="btn-small" id="clearNotifications">清空</button>
      </div>
    `,t.insertBefore(this._btnEl,t.firstChild),document.body.appendChild(this._panelEl),this.addCleanup(()=>{this._panelEl&&this._panelEl.parentNode&&this._panelEl.parentNode.removeChild(this._panelEl),this._btnEl&&this._btnEl.parentNode&&this._btnEl.parentNode.removeChild(this._btnEl)}),this.updateBadge())}setPanelVisible(t){this._panelEl&&(this._panelEl.classList.toggle("hidden",!t),this._panelEl.style.display=t?"flex":"none")}isPanelVisible(){return this._panelEl?window.getComputedStyle(this._panelEl).display!=="none"&&!this._panelEl.classList.contains("hidden"):!1}setupEventListeners(){const t=this._btnEl,e=this._panelEl,i=document.getElementById("closeNotificationPanel"),s=document.getElementById("markAllRead"),a=document.getElementById("clearNotifications"),n=document.getElementById("deleteReadNotifications");t&&this.addListener(t,"click",r=>{r.stopPropagation(),this.setPanelVisible(!this.isPanelVisible())}),i&&this.addListener(i,"click",()=>this.setPanelVisible(!1)),s&&this.addListener(s,"click",()=>this.markAllAsRead()),a&&this.addListener(a,"click",()=>this.clearAll()),n&&this.addListener(n,"click",()=>this.deleteRead()),document.querySelectorAll(".notif-filter-btn").forEach(r=>{this.addListener(r,"click",()=>{this.currentFilter=r.dataset.filter||"all",this.renderNotifications()})}),this.addListener(document,"click",r=>{e&&t&&!e.contains(r.target)&&!t.contains(r.target)&&this.setPanelVisible(!1)})}addNotification(t){const e={id:Date.now()+Math.floor(Math.random()*1e3),title:t.title||"通知",message:t.message||"",type:t.type||"info",timestamp:new Date().toISOString(),read:!1,...t};this.notifications.unshift(e),this.notifications=this.notifications.slice(0,100),this.unreadCount=this.notifications.filter(i=>!i.read).length,this.updateBadge(),this.renderNotifications(),this.saveNotifications(),"Notification"in window&&Notification.permission==="granted"&&new Notification(e.title,{body:e.message,tag:e.id})}markAsRead(t){const e=this.notifications.find(i=>i.id===t);e&&!e.read&&(e.read=!0,this.unreadCount=Math.max(0,this.unreadCount-1),this.updateBadge(),this.renderNotifications(),this.saveNotifications())}markAllAsRead(){this.notifications.forEach(t=>{t.read=!0}),this.unreadCount=0,this.updateBadge(),this.renderNotifications(),this.saveNotifications()}deleteRead(){this.notifications=this.notifications.filter(t=>!t.read),this.unreadCount=this.notifications.filter(t=>!t.read).length,this.updateBadge(),this.renderNotifications(),this.saveNotifications()}deleteOne(t){this.notifications=this.notifications.filter(e=>Number(e.id)!==Number(t)),this.unreadCount=this.notifications.filter(e=>!e.read).length,this.updateBadge(),this.renderNotifications(),this.saveNotifications()}clearAll(){this.notifications=[],this.unreadCount=0,this.updateBadge(),this.renderNotifications(),this.saveNotifications()}updateBadge(){const t=document.getElementById("notificationBadge");t&&(this.unreadCount>0?(t.textContent=this.unreadCount>99?"99+":this.unreadCount,t.style.display="block"):t.style.display="none")}renderNotifications(){const t=document.getElementById("notificationList");if(!t)return;const e=this.notifications.filter(s=>this.currentFilter==="unread"?!s.read:this.currentFilter==="read"?!!s.read:!0);if(e.length===0){t.innerHTML=`<div class="empty-state">${this.currentFilter==="all"?"暂无通知":"当前筛选下暂无通知"}</div>`,this.updateFilterButtons();return}const i=e.slice(0,50).map(s=>{const a=new Date(s.timestamp).toLocaleString("zh-CN");return`
        <div class="notification-item notification-${s.type} ${s.read?"read":""}" data-id="${s.id}">
          <div class="notification-item-header">
            <span class="notification-item-title">${g(s.title)}</span>
            <span class="notification-item-time">${a}</span>
          </div>
          <div class="notification-item-message">${g(s.message)}</div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px; gap:6px;">
            ${s.read?"":'<button class="btn-small notif-mark-read" style="padding:2px 8px; font-size:0.72em;">标记已读</button>'}
            <button class="btn-small notif-delete-one" style="padding:2px 8px; font-size:0.72em;">删除</button>
          </div>
        </div>
      `}).join("");t.innerHTML=i,t.querySelectorAll(".notification-item").forEach(s=>{const a=Number(s.dataset.id),n=s.querySelector(".notif-mark-read"),l=s.querySelector(".notif-delete-one");n&&n.addEventListener("click",r=>{r.stopPropagation(),this.markAsRead(a)}),l&&l.addEventListener("click",r=>{r.stopPropagation(),this.deleteOne(a)}),s.addEventListener("click",()=>this.markAsRead(a))}),this.updateFilterButtons()}updateFilterButtons(){document.querySelectorAll(".notif-filter-btn").forEach(t=>{const e=t.dataset.filter===this.currentFilter;t.style.background=e?"rgba(59,130,246,0.2)":"rgba(59,130,246,0.08)",t.style.borderColor=e?"rgba(59,130,246,0.45)":"var(--border-color)",t.style.color=e?"var(--text-primary)":"var(--text-secondary)",t.style.fontWeight=e?"600":"500"})}loadNotifications(){try{const t=localStorage.getItem("notifications");if(t){const e=JSON.parse(t);this.notifications=Array.isArray(e)?e.map((i,s)=>({id:Number(i.id)||Date.now()+s,title:i.title||"通知",message:i.message||"",type:i.type||"info",timestamp:i.timestamp||new Date().toISOString(),read:!!i.read})):[],this.unreadCount=this.notifications.filter(i=>!i.read).length,this.updateBadge(),this.renderNotifications()}}catch(t){console.error("加载通知失败:",t),this.notifications=[],this.unreadCount=0}}saveNotifications(){try{localStorage.setItem("notifications",JSON.stringify(this.notifications.slice(0,100)))}catch(t){console.error("保存通知失败:",t)}}}class Yt extends st{constructor(){super(),this._viewMode="list",this._styleInjected=!1}get viewMode(){return this._viewMode}setViewMode(t){this._viewMode=t}renderTopology(t){if(!t||t.length===0)return'<div class="empty-state">暂无Agent</div>';this._injectStyles();const e=new Map(t.map(c=>[c.id,c])),i=new Map;t.forEach(c=>{if(c.parentId&&e.has(c.parentId)){i.has(c.parentId)||i.set(c.parentId,[]);const d=i.get(c.parentId);d.includes(c.id)||d.push(c.id)}c.subagents&&c.subagents.forEach(d=>{if(e.has(d)){i.has(c.id)||i.set(c.id,[]);const u=i.get(c.id);u.includes(d)||u.push(d)}})});const s=new Set(Array.from(i.values()).flat()),a=t.filter(c=>!s.has(c.id)),n=t.filter(c=>c.status==="active").length,l=t.filter(c=>c.status==="idle").length,r=t.reduce((c,d)=>c+(d.sessionCount||0),0),m=`
      <div class="topo-stats">
        <div class="topo-stat" style="--accent: #3b82f6;">${t.length}<span>Agent 总数</span></div>
        <div class="topo-stat" style="--accent: #10b981;">${n}<span>活跃中</span></div>
        <div class="topo-stat" style="--accent: #f59e0b;">${l}<span>空闲中</span></div>
        <div class="topo-stat" style="--accent: #8b5cf6;">${r}<span>总会话数</span></div>
      </div>
    `,x=a.map(c=>{const d=(i.get(c.id)||[]).map(u=>e.get(u)).filter(Boolean);return this._renderNode(c,d,e,i)}).join("");return`${m}<div class="topo-tree">${x}</div>`}renderSwimlane(t,e){if(!t||t.length===0)return"";const i=new Map((e||[]).map(a=>[a.id,a]));return`
      <div class="swimlane-container">
        <div class="swimlane-header">⚔️ 作战态势</div>
        ${t.map(a=>{const n=i.get(a.agentId),l=n?n.emoji:"🤖",r=a.agentName||(n?n.name:a.agentId),m=gt(a.lastUpdate);return`
        <div class="swimlane-row">
          <div class="swimlane-agent">${l} ${g(r)}</div>
          <div class="swimlane-bar">
            <div class="swimlane-task-bar">
              <span class="swimlane-task-title">${g(a.title||"(无标题)")}</span>
            </div>
          </div>
          <div class="swimlane-meta">${a.messageCount} msgs, ${m}</div>
        </div>
      `}).join("")}
      </div>
    `}_renderNode(t,e,i,s){const n=t.status==="active"?"topo-status--active":"topo-status--idle",l=t.model?`<span class="topo-model">${g(t.model)}</span>`:"",r=t.activeTasks||0;let m="";return e.length>0&&(m=`<div class="topo-children">${e.map(c=>{const d=(s.get(c.id)||[]).map(u=>i.get(u)).filter(Boolean);return this._renderNode(c,d,i,s)}).join("")}</div>`),`
      <div class="topo-node-wrapper">
        <div class="topo-node clickable" onclick="window.showAgentDetail('${t.id}')">
          <div class="topo-node__emoji">${t.emoji||"🤖"}</div>
          <div class="topo-node__name">${g(t.name)}</div>
          <span class="topo-node__pulse ${n}"></span>
          ${l}
          ${r>0?`<span class="topo-node__tasks">${r}</span>`:""}
        </div>
        ${m}
      </div>
    `}_injectStyles(){if(this._styleInjected)return;this._styleInjected=!0;const t=document.createElement("style");t.id="topo-styles",t.textContent=`
      /* === Topology Stats === */
      .topo-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      .topo-stat {
        background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 5%, transparent));
        padding: 16px;
        border-radius: 12px;
        text-align: center;
        font-size: 2em;
        font-weight: 700;
        color: var(--accent);
      }
      .topo-stat span {
        display: block;
        font-size: 0.425em;
        font-weight: 400;
        color: var(--text-secondary);
        margin-top: 4px;
      }

      /* === Topology Tree === */
      .topo-tree {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding: 20px 0;
      }
      .topo-node-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
      }
      .topo-children {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        padding-top: 24px;
        position: relative;
      }
      /* Vertical connector from parent to children row */
      .topo-children::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 2px;
        height: 24px;
        background: var(--border-color);
        transform: translateX(-50%);
        top: -24px;
      }
      /* Horizontal connector across children */
      .topo-children::after {
        content: '';
        position: absolute;
        top: 0;
        left: 10%;
        right: 10%;
        height: 2px;
        background: var(--border-color);
      }
      /* Vertical connector from horizontal line to each child */
      .topo-children > .topo-node-wrapper::before {
        content: '';
        position: absolute;
        top: -24px;
        left: 50%;
        width: 2px;
        height: 24px;
        background: var(--border-color);
        transform: translateX(-50%);
      }

      /* === Node === */
      .topo-node {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px 18px;
        border-radius: 14px;
        background: var(--bg-card);
        border: 2px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        min-width: 110px;
      }
      .topo-node:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        border-color: var(--accent);
      }
      .topo-node__emoji {
        font-size: 1.8em;
      }
      .topo-node__name {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-primary);
        text-align: center;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .topo-node__pulse {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--bg-card);
      }
      .topo-status--active {
        background: #10b981;
        animation: topoPulse 2s infinite;
      }
      .topo-status--idle {
        background: #f59e0b;
      }
      .topo-status--error {
        background: #ef4444;
        animation: topoFlash 1s infinite;
      }
      @keyframes topoPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      }
      @keyframes topoFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .topo-model {
        font-size: 0.65em;
        padding: 2px 8px;
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        border-radius: 8px;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .topo-node__tasks {
        position: absolute;
        top: -6px;
        left: -6px;
        background: #3b82f6;
        color: white;
        font-size: 0.65em;
        font-weight: 700;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--bg-card);
      }

      /* === Swimlane === */
      .swimlane-container {
        margin-top: 16px;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        background: var(--bg-card);
      }
      .swimlane-header {
        font-size: 0.95em;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
      }
      .swimlane-row {
        display: grid;
        grid-template-columns: 120px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(0,0,0,0.04);
      }
      .swimlane-row:last-child { border-bottom: none; }
      .swimlane-agent {
        font-size: 0.82em;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .swimlane-bar {
        height: 28px;
        background: rgba(59, 130, 246, 0.08);
        border-radius: 6px;
        overflow: hidden;
      }
      .swimlane-task-bar {
        height: 100%;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.2));
        border-radius: 6px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        animation: swimlaneGrow 0.5s ease-out;
      }
      @keyframes swimlaneGrow {
        from { width: 0; }
        to { width: 100%; }
      }
      .swimlane-task-title {
        font-size: 0.75em;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .swimlane-meta {
        font-size: 0.72em;
        color: var(--text-secondary);
        white-space: nowrap;
      }

      /* === Mobile: degrade topology to vertical list === */
      @media (max-width: 768px) {
        .topo-tree {
          align-items: stretch;
        }
        .topo-children {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          padding-left: 24px;
        }
        .topo-children::before,
        .topo-children::after,
        .topo-children > .topo-node-wrapper::before {
          display: none;
        }
        .topo-node {
          flex-direction: row;
          min-width: unset;
        }
        .topo-node__emoji { font-size: 1.2em; }
        .swimlane-row {
          grid-template-columns: 80px 1fr;
        }
        .swimlane-meta { display: none; }
      }

      /* === View toggle button === */
      .topo-view-toggle {
        display: inline-flex;
        gap: 4px;
        background: rgba(0,0,0,0.06);
        border-radius: 8px;
        padding: 3px;
        margin-left: 12px;
      }
      .topo-view-btn {
        padding: 4px 12px;
        border: none;
        border-radius: 6px;
        font-size: 0.75em;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: transparent;
        color: var(--text-secondary);
      }
      .topo-view-btn.active {
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
      }
    `,document.head.appendChild(t),this.addCleanup(()=>{const e=document.getElementById("topo-styles");e&&e.remove()})}}let S=null;class Xt extends st{constructor(){super(),this.ws=new qt,this.data={},this.autoScroll=!0,this.panelRefreshState={modelUsage:0,skillUsage:0,resources:0,alerts:0,statistics:0,messages:0},this.modelTokenDimension="total",this._layoutTimeouts=[],this.topology=new Yt,this._modelUsageRequestSeq=0,this._modelUsageDataCache=new Map,this._modelUsageInFlight=new Map,I.on("ws:message",t=>this._handleWsMessage(t)),I.on("ws:status",t=>this._updateConnectionStatus(t)),I.on("request:refresh",()=>this.loadInitialData())}async init(){this.ws.connect(),this._setupEventListeners(),await this.loadInitialData(),this._startClock(),this._startPolling(),requestIdleCallback(async()=>{const t=await L(()=>import("./charts-manager-ESgEbMse.js"),__vite__mapDeps([0,1]));S=new t.ChartsManager,S.init()})}_handleWsMessage(t){t.type==="update"&&t.data?(this.data={...this.data,...t.data},this.updateAllPanels()):t.type==="config-changed"?this.loadInitialData():t.type==="alert"&&t.data&&window._notificationCenter&&t.data.alerts&&t.data.alerts.forEach(e=>{window._notificationCenter.addNotification({title:`告警: ${e.ruleName}`,message:e.message,type:e.severity==="critical"?"error":e.severity==="warning"?"warning":"info"})})}_updateConnectionStatus(t){const e=document.getElementById("connectionStatus");if(!e)return;const i=e.querySelector(".status-dot"),s=e.querySelector("span:last-child");!i||!s||(i.className="status-dot",t==="connected"?(i.classList.add("connected"),s.textContent="已连接"):t==="disconnected"?(i.classList.add("disconnected"),s.textContent="已断开"):t==="error"?(i.classList.add("disconnected"),s.textContent="连接错误"):s.textContent="连接中...")}_setupEventListeners(){const t=document.getElementById("clearLogs");t&&this.addListener(t,"click",()=>{const s=document.getElementById("logContainer");s&&(s.innerHTML="")});const e=document.getElementById("toggleAutoScroll");e&&this.addListener(e,"click",s=>{this.autoScroll=!this.autoScroll,s.target.textContent=`自动滚动: ${this.autoScroll?"ON":"OFF"}`}),this._setupQuickActions();const i=document.querySelector('[data-card-id="agents"] .card-actions');if(i){const s=document.createElement("div");s.className="topo-view-toggle",s.innerHTML=`
        <button class="topo-view-btn active" data-view="list">列表</button>
        <button class="topo-view-btn" data-view="topology">拓扑</button>
      `,i.appendChild(s),this.addListener(s,"click",a=>{const n=a.target.closest(".topo-view-btn");n&&(s.querySelectorAll(".topo-view-btn").forEach(l=>l.classList.remove("active")),n.classList.add("active"),this.topology.setViewMode(n.dataset.view),this.updateAgentsList())})}}_setupQuickActions(){const t=document.getElementById("restartGateway");t&&this.addListener(t,"click",async()=>{confirm("确定要重启Gateway吗？")&&await this._executeAction("restart-gateway","重启Gateway")});const e=document.getElementById("clearLogsAction");e&&this.addListener(e,"click",async()=>{confirm("确定要清理所有日志文件吗？")&&await this._executeAction("clear-logs","清理日志")});const i=document.getElementById("reloadConfig");i&&this.addListener(i,"click",async()=>{await this._executeAction("reload-config","重新加载配置")});const s=document.getElementById("exportReport");s&&this.addListener(s,"click",()=>{const a=prompt(`选择导出格式：
1. JSON
2. CSV`,"1");window.location.href=`/api/actions/export-report?format=${a==="2"?"csv":"json"}`})}async _executeAction(t,e){try{const i=await Wt(t);alert(`${e}成功：${i.message||"操作完成"}`),t==="reload-config"&&this.loadInitialData()}catch(i){alert(`${e}失败：${i.message}`)}}async loadInitialData(){try{const t=await H("/api/dashboard");this.data=t,window._searchManager&&window._searchManager.setDashboardData(t),this.updateAllPanels()}catch(t){console.error("加载初始数据失败:",t),this._showLoadingError()}}_showLoadingError(){["systemOverview","agentsList","currentTasks","channelsStatus","taskHistory","skillUsageStats","logContainer"].forEach(t=>{const e=document.getElementById(t);e&&(e.innerHTML='<div class="empty-state" style="color: var(--error);">❌ 无法加载数据</div>')})}updateAllPanels(){this.updateHealthPanel(),this.updateSystemOverview(),this.updateAgentsList(),this.updateCurrentTasks(),this.updateChannelsStatus(),this.updateTaskHistory(),this._maybeRefresh("modelUsage",6e4,()=>this.updateModelUsageStats()),this._maybeRefresh("skillUsage",6e4,()=>this.updateSkillUsageStats()),this.updateLogs(),window._sidebarManager&&(this._maybeRefresh("resources",15e3,()=>this._updateResourcesPanel()),this._maybeRefresh("alerts",15e3,()=>this._updateAlertsPanel()),this._maybeRefresh("statistics",2e4,()=>this._updateStatisticsPanel()),this._maybeRefresh("messages",3e4,()=>this._updateMessagesPanel())),S&&S.updateAllCharts(),this._triggerLayout()}_triggerLayout(){this._layoutTimeouts.forEach(i=>clearTimeout(i)),this._layoutTimeouts=[];const t=()=>{window._dragDrop&&window._dragDrop.layoutMasonry&&window._dragDrop.layoutMasonry()},e=document.querySelector(".grid");e&&e.offsetHeight,t(),requestAnimationFrame(t),[200,1e3].forEach(i=>{this._layoutTimeouts.push(setTimeout(t,i))})}_maybeRefresh(t,e,i){const s=Date.now();s-(this.panelRefreshState[t]||0)<e||(this.panelRefreshState[t]=s,Promise.resolve().then(i).catch(a=>console.error(`刷新面板失败: ${t}`,a)))}_startPolling(){this.addInterval(()=>{this.ws.isConnected||this.loadInitialData()},1e4)}_startClock(){const t=()=>{const e=document.getElementById("updateTime");e&&(e.textContent=new Date().toLocaleTimeString("zh-CN"))};t(),this.addInterval(t,1e3)}updateHealthPanel(){if(!this.data||!this.data.health){const a=document.getElementById("healthScore"),n=a&&a.querySelector(".score-value");n&&(n.textContent="--");const l=document.getElementById("healthStatus");l&&(l.innerHTML='<div class="status-badge">检测中...</div>');return}const t=this.data.health,e=document.getElementById("healthScore")?.querySelector(".score-value");if(!e)return;e.textContent=t.score,e.style.animation=t.score>=80?"scoreGlow 2s ease-in-out infinite":t.score>=50?"scoreGlow 1.5s ease-in-out infinite":"scoreGlow 1s ease-in-out infinite";const i=document.getElementById("healthStatus")?.querySelector(".status-badge");if(!i)return;i.className="status-badge",t.status==="healthy"?(i.classList.add("healthy"),i.textContent="健康"):t.status==="warning"?(i.classList.add("warning"),i.textContent="警告"):(i.classList.add("critical"),i.textContent="严重");const s=document.getElementById("healthIssues");s&&(t.issues&&t.issues.length>0?s.innerHTML=t.issues.map(a=>`<div class="issue-item">${a.message}</div>`).join(""):s.innerHTML="")}updateSystemOverview(){if(!this.data.system)return;const t=this.data.system,e=t.gateway.status==="running",i=parseFloat(t.gateway.cpu)||0,s=t.gateway.memory||"0 KB",a=parseFloat(s.replace(/[^\d.]/g,""))||0,n=s.includes("KB")?a/1024:a,l=Number(t.totalMemory),r=l>0&&!isNaN(l)?l:2048,m=Math.min(100,Math.max(0,n/r*100)),x=h=>h>80?"#ef4444":h>50?"#f59e0b":"#3b82f6",c=h=>h>80?"#ef4444":h>50?"#f59e0b":"#8b5cf6",d=x(i),u=c(m),f=26,T=2*Math.PI*f,B=`
      <div class="so-metric-grid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: ${e?"rgba(16, 185, 129, 0.1)":"rgba(239, 68, 68, 0.1)"}; border: 1px solid ${e?"rgba(16, 185, 129, 0.2)":"rgba(239, 68, 68, 0.2)"};">
          <div style="font-size: 1.8em; margin-bottom: 6px;">${e?"✅":"❌"}</div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">Gateway</div>
          <div style="font-size: 0.9em; font-weight: 600; color: ${e?"#10b981":"#ef4444"};">${e?"运行中":"已停止"}</div>
        </div>
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="${f}" fill="none" stroke="rgba(59, 130, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="${f}" fill="none" stroke="${d}" stroke-width="6" stroke-dasharray="${T}" stroke-dashoffset="${T*(1-i/100)}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.85em; font-weight: 700; color: ${d};">${i.toFixed(0)}%</div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">CPU 占用</div>
        </div>
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="${f}" fill="none" stroke="rgba(139, 92, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="${f}" fill="none" stroke="${u}" stroke-width="6" stroke-dasharray="${T}" stroke-dashoffset="${T*(1-m/100)}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7em; font-weight: 700; color: ${u};" title="${m.toFixed(1)}% (${n.toFixed(0)}MB / ${r}MB)">${n.toFixed(0)}MB</div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);" title="${m.toFixed(1)}% 占用">内存占用</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; font-size: 0.85em;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🏠</span><span style="color: var(--text-secondary);">主机</span>
          <span title="${t.hostname}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.hostname}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🔢</span><span style="color: var(--text-secondary);">PID</span>
          <span style="margin-left: auto; font-weight: 500;">${t.gateway.pid||"N/A"}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">⏱️</span><span style="color: var(--text-secondary);">运行时间</span>
          <span style="margin-left: auto; font-weight: 500;">${t.gateway.uptime||"N/A"}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🌐</span><span style="color: var(--text-secondary);">端口</span>
          <span style="margin-left: auto; font-weight: 500;">${t.gateway.port||"N/A"}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">📦</span><span style="color: var(--text-secondary);">Node.js</span>
          <span style="margin-left: auto; font-weight: 500;">${t.nodeVersion}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🖥️</span><span style="color: var(--text-secondary);">架构</span>
          <span title="${t.platform} ${t.arch}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.platform} ${t.arch}</span>
        </div>
      </div>
    `,E=document.getElementById("systemOverview");E&&(E.innerHTML=B)}updateAgentsList(){if(!this.data.agents||this.data.agents.length===0){const d=document.getElementById("agentsList");d&&(d.innerHTML='<div class="empty-state">暂无Agent</div>');return}if(window._searchManager&&window._searchManager.currentFilters?.agents?.keyword){window._searchManager.filterAgents();return}if(this.topology.viewMode==="topology"){const d=document.getElementById("agentsList");if(d){const u=this.topology.renderTopology(this.data.agents),f=this.data.tasks&&this.data.tasks.current?this.topology.renderSwimlane(this.data.tasks.current,this.data.agents):"";d.innerHTML=u+f}return}const t=this.data.agents,e=new Map(t.map(d=>[d.id,d])),i=new Map,s=d=>(i.has(d)||i.set(d,[]),i.get(d));t.forEach(d=>{d.parentId&&e.has(d.parentId)&&s(d.parentId).push(d.id),d.subagents&&d.subagents.forEach(u=>{if(e.has(u)){const f=s(d.id);f.includes(u)||f.push(u)}})});const a=new Set(Array.from(i.values()).flat()),n=t.filter(d=>!a.has(d.id)),l=t.filter(d=>d.status==="active").length,r=t.filter(d=>d.status==="idle").length,m=t.reduce((d,u)=>d+(u.sessionCount||0),0),x=`
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #3b82f6;">${t.length}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">Agent 总数</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #10b981;">${l}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">活跃中</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #f59e0b;">${r}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">空闲中</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(167, 139, 250, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #8b5cf6;">${m}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">总会话数</div>
        </div>
      </div>
      <div class="org-tree">
        ${n.map(d=>this._renderAgentNode(d,e,i,0)).join("")}
      </div>
    `,c=document.getElementById("agentsList");c&&(c.innerHTML=x)}_renderAgentNode(t,e,i,s){const a=i.get(t.id)||[],n=a.length>0,l=t.status==="active",r=l?"#10b981":"#f59e0b",m=l?"rgba(16, 185, 129, 0.1)":"rgba(245, 158, 11, 0.1)",x=l?"活跃":"空闲";if(s===0){let c="";if(n){const d={"direct-department":{label:"直属部门",icon:"🏛️",accent:"#2563eb",accentBg:"rgba(37, 99, 235, 0.1)",accentBorder:"rgba(37, 99, 235, 0.18)"},"special-envoy":{label:"特使机构",icon:"📜",accent:"#d97706",accentBg:"rgba(217, 119, 6, 0.1)",accentBorder:"rgba(217, 119, 6, 0.18)"},"managed-agent":{label:"下级 Agent",icon:"🧩",accent:"#0f766e",accentBg:"rgba(15, 118, 110, 0.1)",accentBorder:"rgba(15, 118, 110, 0.18)"},"runtime-subagent":{label:"下级 Agent",icon:"🧩",accent:"#0f766e",accentBg:"rgba(15, 118, 110, 0.1)",accentBorder:"rgba(15, 118, 110, 0.18)"},independent:{label:"独立实例",icon:"🛰️",accent:"#6b7280",accentBg:"rgba(107, 114, 128, 0.1)",accentBorder:"rgba(107, 114, 128, 0.18)"}},u=["direct-department","special-envoy","managed-agent","runtime-subagent","independent"],f=new Map;a.forEach(h=>{const j=e.get(h)?.organizationType||"managed-agent";f.has(j)||f.set(j,[]),f.get(j).push(h)});const T=u.filter(h=>f.has(h)).map(h=>({key:h,meta:d[h]||d["managed-agent"],items:f.get(h)||[]})),B=T.map(h=>`${h.meta.label} ${h.items.length}`).join(" · ")||`组织成员 ${a.length}`,E=T.map((h,D)=>{const j=h.items.map(at=>{const w=e.get(at);if(!w)return`<div class="agent-subagent-card" style="padding: 12px; text-align: center; background: rgba(100,100,100,0.05); border: 1px dashed var(--border); border-radius: 12px;"><div style="font-size: 2em; margin-bottom: 8px;">🔗</div><div style="font-size: 0.85em; color: var(--text-secondary);">${at}</div><div style="font-size: 0.7em; color: var(--text-muted);">未配置</div></div>`;const z=w.status==="active",ot=z?"#10b981":"#f59e0b",P=z?"rgba(16, 185, 129, 0.08)":"rgba(245, 158, 11, 0.08)",R=z?"rgba(16, 185, 129, 0.3)":"rgba(245, 158, 11, 0.3)",F=w.organizationLabel||h.meta.label;return`
              <div class="clickable agent-subagent-card" onclick="event.stopPropagation(); window.showAgentDetail('${w.id}')" style="padding: 12px; text-align: center; background: ${P}; border-radius: 12px; cursor: pointer; border: 1px solid ${R}; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                <div style="position: relative; display: inline-block;">
                  <div style="font-size: 2em; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: ${z?"rgba(16, 185, 129, 0.15)":"rgba(245, 158, 11, 0.15)"}; border-radius: 12px; margin: 0 auto 8px;">${w.emoji}</div>
                  <span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: ${ot}; border-radius: 50%; border: 2px solid var(--card-bg); ${z?"animation: pulse 2s infinite;":""}"></span>
                </div>
                <div style="font-weight: 600; font-size: 0.85em; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g(w.name)}</div>
                <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin-bottom: 4px;">
                  <div style="font-size: 0.65em; padding: 1px 6px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px;">${g(w.role||"助手")}</div>
                  <div style="font-size: 0.65em; padding: 1px 6px; background: ${h.meta.accentBg}; color: ${h.meta.accent}; border-radius: 8px; border: 1px solid ${h.meta.accentBorder};">${g(F)}</div>
                </div>
                <div style="font-size: 0.7em; color: var(--text-muted);">${w.sessionCount||0} 会话</div>
              </div>`}).join("");return`<div style="margin-top: ${D===0?0:14}px;"><div style="display: flex; align-items: center; gap: 6px; font-size: 0.78em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 600;"><span>${h.meta.icon}</span><span>${h.meta.label} (${h.items.length})</span></div><div class="agent-subagent-list">${j}</div></div>`}).join("");c=`<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);"><div style="font-size: 0.8em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 500;"><span style="margin-right: 4px;">🏷️</span> ${B} (${a.length})</div>${E}</div>`}return`
        <div class="agent-org-node" style="margin-bottom: 16px;">
          <div class="agent-card clickable" onclick="window.showAgentDetail('${t.id}')" style="background: var(--card-bg); border: 2px solid ${l?"rgba(16, 185, 129, 0.3)":"var(--border)"}; border-radius: 12px; padding: 16px; transition: all 0.2s; cursor: pointer; ${l?"box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);":""}" onmouseover="this.style.transform='translateX(4px)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.transform='none'; this.style.borderColor='${l?"rgba(16, 185, 129, 0.3)":"var(--border)"}';">
            <div style="display: grid; grid-template-columns: minmax(220px, 1fr) minmax(360px, auto); gap: 14px; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <div style="font-size: 1.8em; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; background: ${m}; border-radius: 10px;">${t.emoji}</div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.05em; font-weight: 600; color: var(--text-primary);">${g(t.name)}</span>
                    <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 10px; font-weight: 500;">${g(t.role||"通用助手")}</span>
                  </div>
                  <div style="font-size: 0.75em; color: var(--text-secondary); font-family: monospace;">${t.id}</div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: minmax(170px, 1.4fr) repeat(3, minmax(72px, auto)); gap: 12px; align-items: center; justify-content: end;">
                <div style="text-align: center; min-width: 0;"><div style="font-size: 0.7em; color: var(--text-secondary);">模型</div><div title="${t.model||"N/A"}" style="font-size: 0.8em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.model||"N/A"}</div></div>
                <div style="text-align: center;"><div style="font-size: 0.7em; color: var(--text-secondary);">会话</div><div style="font-size: 0.8em; font-weight: 500;">${t.sessionCount||0}</div></div>
                <div style="text-align: center;"><div style="font-size: 0.7em; color: var(--text-secondary);">活动</div><div style="font-size: 0.8em; font-weight: 500;">${t.lastActivity?gt(t.lastActivity):"N/A"}</div></div>
                <span style="padding: 4px 10px; background: ${m}; color: ${r}; border-radius: 16px; font-size: 0.75em; font-weight: 600;">
                  <span style="display: inline-block; width: 5px; height: 5px; background: ${r}; border-radius: 50%; margin-right: 5px; ${l?"animation: pulse 2s infinite;":""}"></span>${x}
                </span>
              </div>
            </div>
            ${c}
          </div>
        </div>`}return""}updateCurrentTasks(){const t=document.getElementById("taskAgentFilter");if(t&&this.data.agents){const s=t.value;t.innerHTML='<option value="all">全部Agent</option>',this.data.agents.forEach(a=>{const n=document.createElement("option");n.value=a.id,n.textContent=a.name,t.appendChild(n)}),t.value=s||"all"}if(!this.data.tasks||!this.data.tasks.current||this.data.tasks.current.length===0){const s=document.getElementById("currentTasks");s&&(s.innerHTML='<div class="empty-state">暂无当前任务</div>');return}if(window._searchManager&&window._searchManager.currentFilters?.tasks?.keyword){window._searchManager.filterTasks();return}const e=this.data.tasks.current.slice(0,10).map(s=>`
      <div class="task-item clickable" onclick="window.showTaskDetail('${s.id}')">
        <div class="task-header">
          <span><strong>${g(s.agentName)}</strong></span>
          <span class="badge badge-blue">进行中</span>
        </div>
        <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${g(s.title||"(无标题)")}</div>
        <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${s.id.substring(0,12)}...</div>
        <div class="task-time">消息数: ${s.messageCount} | 更新: ${new Date(s.lastUpdate).toLocaleString("zh-CN")}</div>
      </div>
    `).join(""),i=document.getElementById("currentTasks");i&&(i.innerHTML=e)}updateChannelsStatus(){if(!this.data.channels||this.data.channels.length===0){const s=document.getElementById("channelsStatus");s&&(s.innerHTML='<div class="empty-state">暂无通道</div>');return}const t={telegram:"📱",discord:"🎮",whatsapp:"💬",feishu:"📋"},e=this.data.channels.map(s=>{const a=s.status==="normal"?"status-ok":s.status==="warning"?"status-warn":"status-error",n=s.status==="normal"?"正常":s.status==="warning"?"警告":"异常",l=s.status==="normal"?"✅":s.status==="warning"?"⚠️":"❌";return`
        <div class="channel-item">
          <div class="channel-name">${t[s.name.toLowerCase()]||"📡"} ${g(s.name)}</div>
          <div class="channel-status ${a}">${l} ${n}</div>
          ${s.lastMessage?`<div style="font-size: 0.8em; color: var(--text-muted); margin-top: 4px;">${g(s.lastMessage)}</div>`:""}
        </div>`}).join(""),i=document.getElementById("channelsStatus");i&&(i.innerHTML=`<div class="channel-grid">${e}</div>`)}updateTaskHistory(){if(!this.data.tasks||!this.data.tasks.history||this.data.tasks.history.length===0){const i=document.getElementById("taskHistory");i&&(i.innerHTML='<div class="empty-state">暂无历史任务</div>');return}if(window._searchManager&&window._searchManager.currentFilters?.tasks?.keyword){window._searchManager.filterTasks();return}const t=this.data.tasks.history.slice(0,10).map(i=>`
      <div class="task-item clickable" onclick="window.showTaskDetail('${i.id}')">
        <div class="task-header">
          <span><strong>${g(i.agentName)}</strong></span>
          <span class="badge badge-green">已完成</span>
        </div>
        <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${g(i.title||"(无标题)")}</div>
        <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${i.id.substring(0,12)}...</div>
        <div class="task-time">消息数: ${i.messageCount} | 完成: ${new Date(i.lastUpdate).toLocaleString("zh-CN")}</div>
      </div>
    `).join(""),e=document.getElementById("taskHistory");e&&(e.innerHTML=t)}_idleOnce(t=120){return new Promise(e=>{typeof window<"u"&&typeof window.requestIdleCallback=="function"?window.requestIdleCallback(()=>e(),{timeout:t}):setTimeout(e,0)})}async _fetchModelUsageData(t,e){const i=Date.now(),s=2e4,a=this._modelUsageDataCache.get(t);if(a&&i-a.ts<s)return a.data;if(this._modelUsageInFlight.has(t))return this._modelUsageInFlight.get(t);const n=H(`/api/models/usage?${e}`).then(l=>(this._modelUsageDataCache.set(t,{ts:Date.now(),data:l}),l)).finally(()=>{this._modelUsageInFlight.delete(t)});return this._modelUsageInFlight.set(t,n),n}async updateModelUsageStats(){const t=document.getElementById("modelUsageStats");if(!t)return;const e=document.getElementById("modelUsageRange"),i=e?e.value:"",s=i?`days=${i}`:"";e&&!e._bound&&(e._bound=!0,e.addEventListener("change",()=>{this.panelRefreshState.modelUsage=0,this.updateModelUsageStats()})),this.modelTokenDimension||(this.modelTokenDimension="total");const a=this.modelTokenDimension,n=i||"all",l=++this._modelUsageRequestSeq;try{const r=await this._fetchModelUsageData(n,s);if(l!==this._modelUsageRequestSeq)return;if(!r||r.summary.totalCalls===0){t.innerHTML='<div class="empty-state">暂无模型使用记录</div>';return}if(t.innerHTML=`
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">每日调用趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelUsageTrendCanvas"></canvas>
          </div>
          <h4 style="margin: 16px 0 12px; font-size: 0.95em; color: var(--text-primary);">每日 Token 趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelTokenTrendCanvas"></canvas>
          </div>
        </div>
        <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03); color: var(--text-secondary); font-size: 0.85em;">
          正在加载详细统计...
        </div>
      `,S&&r.byDay&&r.byDay.length>0&&(S.renderModelUsageTrend(r),S.renderModelTokenTrend(r)),await this._idleOnce(),l!==this._modelUsageRequestSeq)return;const m=r.summary,x=r.byModel&&r.byModel.length>0?r.byModel[0]:null,c=r.byAgent&&r.byAgent.length>0?r.byAgent[0]:null,d=r.byDay&&r.byDay.length>0?Math.round(r.byDay.reduce((o,p)=>o+(p.total||0),0)/r.byDay.length):0,u=(r.byDay||[]).slice(-3),f=(r.byDay||[]).slice(-6,-3),T=u.reduce((o,p)=>o+(p.totalTokens||0),0),B=f.reduce((o,p)=>o+(p.totalTokens||0),0),E=u.length>0?Math.round(T/(u.length*24)):0,h=f.length>0?Math.round(B/(f.length*24)):0;let D="stable";h>0&&(E>h*1.15?D="up":E<h*.85&&(D="down"));const j=D==="up"?"📈":D==="down"?"📉":"➡️",at=D==="up"?"#ef4444":D==="down"?"#10b981":"#64748b",w=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"],z=m.totalTokens||(r.byModel||[]).reduce((o,p)=>o+(p.tokens||0),0),ot=z>=1e6?`${(z/1e6).toFixed(1)}M`:z>=1e3?`${(z/1e3).toFixed(1)}K`:z,P=(m.dateRange||"").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/),R=P?P[1]:"",F=P?P[2]:"",mt=P?Math.max(1,Math.round((new Date(F)-new Date(R))/864e5)+1):(r.byDay||[]).length,U="padding:14px; border-radius:10px; text-align:center; min-height:132px; display:flex; flex-direction:column; align-items:center;",O="min-height:62px; display:flex; align-items:center; justify-content:center; width:100%;",q="font-size:0.8em; color:var(--text-secondary); margin-top:auto; line-height:1.2;",ut=`
        <div class="mu-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="${U} background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
            <div style="${O}"><div style="font-size: 2.25em; font-weight: 700; color: #3b82f6; line-height:1;">${m.totalCalls.toLocaleString()}</div></div>
            <div style="${q}">总调用次数</div>
          </div>
          <div style="${U} background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="${O}"><div style="font-size: 2.25em; font-weight: 700; color: #10b981; line-height:1;">${ot}</div></div>
            <div style="${q}">总Token使用量</div>
          </div>
          <div style="${U} background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
            <div style="${O}"><div style="font-size: 2.25em; font-weight: 700; color: #8b5cf6; line-height:1;">${m.totalModels}</div></div>
            <div style="${q}">活跃模型</div>
          </div>
          <div style="${U} background: linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.08)); border: 1px solid rgba(168, 85, 247, 0.2);">
            <div style="${O}"><div style="font-size: 2.05em; font-weight: 700; color: #a855f7; line-height:1;">${E>=1e3?`${(E/1e3).toFixed(1)}K`:E}</div></div>
            <div style="${q}">消耗速度(tokens/h)</div>
          </div>
          <div style="${U} background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2);">
            <div style="${O}"><div style="font-size: 1.55em; font-weight: 700; color: #f59e0b; line-height:1.15;">覆盖 ${mt} 天</div></div>
            <div style="${q}">${R&&F?`${R} → ${F}`:m.dateRange||"统计窗口"}</div>
          </div>
        </div>
      `,V=o=>a==="input"?o.inputTokens||0:a==="output"?o.outputTokens||0:o.tokens||0,A=(r.byModel||[]).filter(o=>(o.tokens||0)>0),Z=[...A].sort((o,p)=>V(p)-V(o)),rt=Z.length>0&&V(Z[0])||1,W=A.reduce((o,p)=>o+(p.inputTokens||0),0),G=A.reduce((o,p)=>o+(p.outputTokens||0),0),tt=W+G,K=tt>0?(W/tt*100).toFixed(1):"0.0",J=tt>0?(G/tt*100).toFixed(1):"0.0",et=a==="input"?W:a==="output"?G:z,vt=`
        <div style="margin-bottom: 16px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.15); background: rgba(59, 130, 246, 0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px; flex-wrap:wrap;">
            <div style="font-size:0.9em; color:var(--text-primary); font-weight:600;">🔄 输入/输出 Token 比例</div>
            <span style="font-size:0.75em; color:var(--text-secondary);">总计 ${$(z)} tokens</span>
          </div>
          <div style="height: 24px; background: rgba(0,0,0,0.06); border-radius: 12px; overflow: hidden; display:flex; margin-bottom:8px;">
            <div style="width:${K}%; background:linear-gradient(90deg, #3b82f6, #60a5fa); display:flex; align-items:center; justify-content:center; transition:width .4s;">
              ${Number(K)>15?`<span style="font-size:0.72em; color:#fff; font-weight:600;">${K}%</span>`:""}
            </div>
            <div style="width:${J}%; background:linear-gradient(90deg, #10b981, #34d399); display:flex; align-items:center; justify-content:center; transition:width .4s;">
              ${Number(J)>15?`<span style="font-size:0.72em; color:#fff; font-weight:600;">${J}%</span>`:""}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:0.78em;">
            <span style="color:#3b82f6;">📥 输入 ${$(W)} (${K}%)</span>
            <span style="color:#10b981;">📤 输出 ${$(G)} (${J}%)</span>
            <span style="color:#8b5cf6;">💾 缓存读 ${$(r.summary?.totalCacheReadTokens||0)}</span>
          </div>
        </div>
      `,ht=Z.slice(0,8).map((o,p)=>{const v=V(o),b=rt>0?(v/rt*100).toFixed(0):0,k=w[p%w.length],M=et>0?(v/et*100).toFixed(1):"0.0";return`
          <div class="mu-token-bar-row" style="display: grid; grid-template-columns: minmax(120px, 1.2fr) 2.4fr auto; gap: 10px; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.82em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g(`${o.provider}/${o.modelName}`)}">${g(o.modelName)}</div>
            <div style="position: relative; background: rgba(0,0,0,0.06); border-radius: 8px; height: 22px; overflow: hidden;">
              <div style="width: ${b}%; height: 100%; background: linear-gradient(90deg, ${k}, rgba(255,255,255,0.25)); border-radius: 8px; transition: width 0.5s;"></div>
              <div style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 0.72em; color: #fff; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.35);">${M}%</div>
            </div>
            <div style="font-size: 0.82em; color: var(--text-primary); font-weight: 600; min-width: 72px; text-align: right;">${$(v)}</div>
          </div>
        `}).join(""),ft=Z.slice(0,6).map((o,p)=>{const v=V(o),b=w[p%w.length],k=et>0?(v/et*100).toFixed(1):"0.0",M=(o.inputTokens||0)+(o.outputTokens||0),_=M>0?((o.inputTokens||0)/M*100).toFixed(0):0,C=M>0?((o.outputTokens||0)/M*100).toFixed(0):0;return`
          <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.18); background: linear-gradient(135deg, rgba(59,130,246,0.04), rgba(139,92,246,0.04));">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
              <div style="font-size:0.88em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${g(`${o.provider}/${o.modelName}`)}">${g(o.modelName)}</div>
              <span style="font-size:0.72em; padding:2px 8px; border-radius:999px; background:${b}22; color:${b}; font-weight:600;">${k}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
              <span style="font-size:1.05em; font-weight:700; color:${b};">${$(v)}</span>
              <span style="font-size:0.75em; color:var(--text-secondary);">${o.count||0} 次调用</span>
            </div>
            <div style="height:8px; background:rgba(0,0,0,0.06); border-radius:999px; overflow:hidden; display:flex;">
              <div style="width:${_}%; background:rgba(59,130,246,0.75);"></div>
              <div style="width:${C}%; background:rgba(16,185,129,0.75);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72em; color:var(--text-secondary);">
              <span>📥 ${$(o.inputTokens||0)}</span>
              <span>📤 ${$(o.outputTokens||0)}</span>
              ${(o.cacheReadTokens||0)>0?`<span>💾 ${$(o.cacheReadTokens)}</span>`:""}
            </div>
          </div>
        `}).join(""),yt=`
        <div style="margin-bottom: 20px; padding: 14px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.18); background: rgba(59, 130, 246, 0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
            <h4 style="margin: 0; font-size: 0.95em; color: var(--text-primary);">各模型 Token 使用量</h4>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <div class="token-dimension-toggle" style="display:flex; gap:4px; background:rgba(0,0,0,0.08); border-radius:8px; padding:3px;">
                <button class="dim-btn" data-dimension="total" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${a==="total"?"rgba(59,130,246,0.9)":"transparent"}; color:${a==="total"?"#fff":"var(--text-secondary)"}">总量</button>
                <button class="dim-btn" data-dimension="input" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${a==="input"?"rgba(59,130,246,0.9)":"transparent"}; color:${a==="input"?"#fff":"var(--text-secondary)"}">输入</button>
                <button class="dim-btn" data-dimension="output" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${a==="output"?"rgba(59,130,246,0.9)":"transparent"}; color:${a==="output"?"#fff":"var(--text-secondary)"}">输出</button>
              </div>
              <span style="font-size:0.78em; color:var(--text-secondary); padding:4px 10px; border-radius:999px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.18);">输入 ${$(W)} (${K}%)</span>
              <span style="font-size:0.78em; color:var(--text-secondary); padding:4px 10px; border-radius:999px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.18);">输出 ${$(G)} (${J}%)</span>
            </div>
          </div>
          ${vt}
          <div class="mu-token-main-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
            <div>
              <div style="font-size:0.82em; color:var(--text-secondary); margin-bottom:8px;">Token 占比条形视图</div>
              ${ht||'<div class="empty-state">无模型 token 数据</div>'}
            </div>
            <div>
              <div style="font-size:0.82em; color:var(--text-secondary); margin-bottom:8px;">Top 模型 Token 卡片视图</div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
                ${ft||'<div class="empty-state">无模型 token 数据</div>'}
              </div>
            </div>
          </div>
        </div>
      `,xt=A.length>0?A[0].count:1,bt=A.slice(0,8).map((o,p)=>{const v=(o.count/xt*100).toFixed(0),b=w[p%w.length];return`
          <div class="mu-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 120px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g(`${o.provider}/${o.modelName}`)}">${g(o.modelName)}</div>
            <div style="flex: 1; background: rgba(0,0,0,0.06); border-radius: 4px; height: 22px; overflow: hidden;">
              <div style="width: ${v}%; height: 100%; background: ${b}; border-radius: 4px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                ${v>15?`<span style="font-size: 0.75em; color: white; font-weight: 600;">${o.count}</span>`:""}
              </div>
            </div>
            ${v<=15?`<span style="font-size: 0.8em; font-weight: 600; color: var(--text-primary); min-width: 30px;">${o.count}</span>`:'<span style="min-width: 30px;"></span>'}
          </div>
        `}).join(""),Y=r.byAgent||[],wt=Y.length>0?Y[0].total:1,$t=Y.slice(0,8).map((o,p)=>{const v=(o.total/wt*100).toFixed(0),b=w[(p+3)%w.length];return`
          <div class="mu-agent-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 100px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g(o.agentName)}">${o.agentEmoji||"🤖"} ${g(o.agentName)}</div>
            <div style="flex: 1; background: rgba(0,0,0,0.06); border-radius: 4px; height: 22px; overflow: hidden;">
              <div style="width: ${v}%; height: 100%; background: ${b}; border-radius: 4px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                ${v>15?`<span style="font-size: 0.75em; color: white; font-weight: 600;">${o.total}</span>`:""}
              </div>
            </div>
            ${v<=15?`<span style="font-size: 0.8em; font-weight: 600; color: var(--text-primary); min-width: 30px;">${o.total}</span>`:'<span style="min-width: 30px;"></span>'}
          </div>
        `}).join(""),X=z>0?((r.byModel||[]).slice(0,3).reduce((o,p)=>o+(p.tokens||0),0)/z*100).toFixed(1):"0.0",kt=Number(X)>=80?"高集中":Number(X)>=60?"中集中":"分散",_t=Number(X)>=80?"#ef4444":Number(X)>=60?"#f59e0b":"#10b981",Tt=`
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="padding: 12px; border-radius: 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">高频模型</div>
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${x?g(`${x.provider}/${x.modelName}`):"暂无数据"}">${x?g(x.modelName):"暂无数据"}</div>
            <div style="font-size: 0.8em; color: #6366f1; margin-top: 4px;">${x?`${x.count} 次调用`:"--"}</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">高频 Agent</div>
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c?g(c.agentName):"暂无数据"}">${c?`${c.agentEmoji||"🤖"} ${g(c.agentName)}`:"暂无数据"}</div>
            <div style="font-size: 0.8em; color: #0ea5e9; margin-top: 4px;">${c?`${c.total} 次调用`:"--"}</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">日均调用</div>
            <div style="font-size: 1.1em; color: #10b981; font-weight: 700; margin-top: 4px;">${d.toLocaleString()} 次/天</div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">按当前筛选范围</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">模型集中度（Top3）</div>
            <div style="font-size: 1.1em; color: ${_t}; font-weight: 700; margin-top: 4px;">${X}%</div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">${kt}</div>
          </div>
        </div>
      `,nt=[...A].map(o=>({...o,avgTokenPerCall:o.count>0?Math.round((o.tokens||0)/o.count):0})).sort((o,p)=>p.avgTokenPerCall-o.avgTokenPerCall).slice(0,6),dt=Y.slice(0,5),zt=Math.max(...dt.map(o=>o.totalTokens||0),1),Mt=`
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(14,165,233,0.2); background:linear-gradient(135deg, rgba(14,165,233,0.04), rgba(99,102,241,0.04));">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">⚡ Agent 作战力</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(14,165,233,0.1); border-radius:999px;">按 token 贡献排名</span>
          </div>
          <div style="padding:10px; border-radius:10px; background:rgba(14,165,233,0.04); border:1px solid rgba(14,165,233,0.15);">
            ${dt.map(o=>{const p=Math.max(5,Math.round((o.totalTokens||0)/zt*100));return`
          <div class="mu-agent-combat-row" style="display:grid; grid-template-columns: minmax(90px, 1.1fr) 2fr auto; gap:8px; align-items:center; margin-bottom:7px;">
            <div style="font-size:0.8em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${o.agentEmoji||"🤖"} ${g(o.agentName)}</div>
            <div style="height:8px; border-radius:999px; background:rgba(0,0,0,0.06); overflow:hidden;">
              <div style="height:100%; width:${p}%; background:linear-gradient(90deg, rgba(14,165,233,0.85), rgba(99,102,241,0.85)); border-radius:999px;"></div>
            </div>
            <div style="font-size:0.75em; color:var(--text-primary); font-weight:600;">${$(o.totalTokens||0)}</div>
          </div>
        `}).join("")||'<div class="empty-state">暂无 Agent 数据</div>'}
          </div>
        </div>
      `,lt=nt.length>0&&nt[0].avgTokenPerCall||1,Et=`
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(245,158,11,0.18); background:rgba(245,158,11,0.03);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">📈 Token 效率榜</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(245,158,11,0.1); border-radius:999px;">平均每次调用</span>
          </div>
          <div class="mu-efficiency-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
            ${nt.map((o,p)=>{const v=lt>0?(o.avgTokenPerCall/lt*100).toFixed(0):0,b=w[p%w.length];return`
          <div style="padding:10px; border-radius:10px; border:1px solid rgba(245,158,11,0.18); background:linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.04));">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px;">
              <div style="font-size:0.82em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${g(`${o.provider}/${o.modelName}`)}">${g(o.modelName)}</div>
              <span style="font-size:0.7em; padding:2px 6px; border-radius:999px; background:${b}22; color:${b}; font-weight:600;">#${p+1}</span>
            </div>
            <div style="font-size:1.15em; font-weight:700; color:#f59e0b; margin-bottom:6px;">${$(o.avgTokenPerCall)} tok<span style="font-size:0.65em; font-weight:500; color:var(--text-secondary);">/次</span></div>
            <div style="height:6px; background:rgba(0,0,0,0.06); border-radius:999px; overflow:hidden;">
              <div style="width:${v}%; height:100%; background:linear-gradient(90deg, #f59e0b, #fbbf24); border-radius:999px; transition:width 0.5s;"></div>
            </div>
            <div style="font-size:0.72em; color:var(--text-secondary); margin-top:4px;">共 ${o.count} 次调用</div>
          </div>
        `}).join("")||'<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `,Ct=Y.slice(0,3),St=Object.fromEntries(A.map(o=>[`${o.provider}/${o.modelId}`,o.modelName||o.modelId])),Lt=`
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(139,92,246,0.18); background:rgba(139,92,246,0.03);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">🎯 Agent-Model 贡献洞察</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(139,92,246,0.1); border-radius:999px;">Top Agent 主力模型</span>
          </div>
          <div class="mu-agent-insights-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
            ${Ct.map((o,p)=>{const v=Object.entries(o.models||{}).map(([_,C])=>({modelKey:_,modelName:St[_]||_.split("/").slice(1).join("/")||_,count:C.count||0,tokens:C.tokens||0})).sort((_,C)=>(C.tokens||0)-(_.tokens||0)).slice(0,3),b=o.totalTokens||v.reduce((_,C)=>_+(C.tokens||0),0),k=w[(p+5)%w.length],M=v.map(_=>{const C=b>0?((_.tokens||0)/b*100).toFixed(0):0;return`
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <div style="flex:1; font-size:0.75em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${g(_.modelName)}">${g(_.modelName)}</div>
              <div style="font-size:0.72em; color:var(--text-primary); font-weight:600;">${$(_.tokens||0)}</div>
              <div style="font-size:0.7em; color:var(--text-secondary);">(${C}%)</div>
            </div>
          `}).join("");return`
          <div style="padding:12px; border-radius:10px; border:1px solid rgba(139,92,246,0.18); background:linear-gradient(135deg, rgba(139,92,246,0.04), rgba(168,85,247,0.04));">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:1.2em;">${o.agentEmoji||"🤖"}</span>
              <div style="flex:1;">
                <div style="font-size:0.88em; font-weight:600; color:var(--text-primary);">${g(o.agentName)}</div>
                <div style="font-size:0.72em; color:var(--text-secondary);">${o.total} 次调用 · ${$(b)} tokens</div>
              </div>
              <span style="font-size:0.7em; padding:2px 8px; border-radius:999px; background:${k}22; color:${k}; font-weight:600;">Top ${p+1}</span>
            </div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(139,92,246,0.1);">
              <div style="font-size:0.75em; color:var(--text-secondary); margin-bottom:6px;">主力模型:</div>
              ${M||'<div style="font-size:0.75em; color:var(--text-secondary);">无数据</div>'}
            </div>
          </div>
        `}).join("")||'<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `,Nt=`
        <div class="mu-middle-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div>
            <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">按模型排名</h4>
            ${bt||'<div class="empty-state">无数据</div>'}
          </div>
          <div>
            <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">按 Agent 排名</h4>
            ${$t||'<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `,ct=["周一","周二","周三","周四","周五","周六","周日"],Bt=o=>{if(!o||typeof o!="string")return null;const p=o.match(/^(\d{4})-(\d{2})-(\d{2})$/);return p?new Date(Number(p[1]),Number(p[2])-1,Number(p[3])):null},Dt=o=>{const p=o.getFullYear(),v=String(o.getMonth()+1).padStart(2,"0"),b=String(o.getDate()).padStart(2,"0");return`${p}-${v}-${b}`},At=o=>{const p=`${String(o.getMonth()+1).padStart(2,"0")}/${String(o.getDate()).padStart(2,"0")}`,v=new Date(o);v.setDate(v.getDate()+6);const b=`${String(v.getMonth()+1).padStart(2,"0")}/${String(v.getDate()).padStart(2,"0")}`;return`${p}-${b}`},Q={};(r.byDay||[]).forEach(o=>{const p=Bt(o.date);if(!p||Number.isNaN(p.getTime()))return;const v=(p.getDay()+6)%7,b=new Date(p);b.setDate(p.getDate()-v);const k=Dt(b);Q[k]||(Q[k]={weekKey:k,weekLabel:At(b),days:{0:0,1:0,2:0,3:0,4:0,5:0,6:0},weekTotal:0});const M=o.totalTokens||0;Q[k].days[v]+=M,Q[k].weekTotal+=M});const it=Object.values(Q).sort((o,p)=>o.weekKey.localeCompare(p.weekKey)).slice(-8),It=Math.max(...it.flatMap(o=>Object.values(o.days)),1),Pt=`
        <div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 4px;">自然周</div>
        ${ct.map(o=>`<div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 2px;">${o}</div>`).join("")}
        <div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 4px;">周总量</div>
      `,Ht=it.length>0?it.map(o=>{const p=ct.map((v,b)=>{const k=o.days[b]||0,M=k>0?k/It:0,_=`rgba(59,130,246, ${.08+M*.74})`,C=M>.5?"#ffffff":"var(--text-primary)";return`
            <div title="${$(k)}" style="height:44px; border-radius:8px; background:${_}; border:1px solid rgba(59,130,246,0.16); display:flex; align-items:center; justify-content:center; font-size:0.76em; font-weight:700; color:${C};">
              ${$(k)}
            </div>
          `}).join("");return`
          <div style="font-size:0.74em; color:var(--text-primary); font-weight:600; text-align:center; padding:0 4px; align-self:center;">${o.weekLabel}</div>
          ${p}
          <div style="font-size:0.76em; color:#2563eb; font-weight:700; text-align:center; padding:0 4px; align-self:center;">${$(o.weekTotal)}</div>
        `}).join(""):'<div class="empty-state" style="grid-column:1 / -1;">暂无周内热力数据</div>',jt=`
        <div class="mu-week-heat-grid" style="display:grid; grid-template-columns: minmax(84px, 1.2fr) repeat(7, minmax(52px, 1fr)) minmax(76px, 1fr); gap:6px; align-items:stretch;">
          ${Pt}
          ${Ht}
        </div>
      `,Rt=`
        <div>
          <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">每日调用趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelUsageTrendCanvas"></canvas>
          </div>
          <h4 style="margin: 16px 0 12px; font-size: 0.95em; color: var(--text-primary);">每日 Token 趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelTokenTrendCanvas"></canvas>
          </div>
          <div style="margin-top: 14px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                <h4 style="margin: 0; font-size: 0.9em; color: var(--text-primary);">🔥 时段热力（按自然周内日）</h4>
                <span style="font-size:0.72em; color:var(--text-secondary);">展示最近 ${Math.max(it.length,1)} 个自然周</span>
              </div>
              ${jt}
          </div>
        </div>
      `;if(l!==this._modelUsageRequestSeq)return;t.innerHTML=ut+Tt+Mt+yt+Et+Lt+Nt+Rt,t.querySelectorAll(".dim-btn").forEach(o=>{o.addEventListener("click",p=>{const v=p.target.dataset.dimension;v&&v!==this.modelTokenDimension&&(this.modelTokenDimension=v,this.updateModelUsageStats())})}),S&&r.byDay&&r.byDay.length>0&&(S.renderModelUsageTrend(r),S.renderModelTokenTrend(r)),window._dragDrop&&window._dragDrop.layoutMasonry&&window._dragDrop.layoutMasonry()}catch(r){console.error("更新模型使用量统计失败:",r),t.innerHTML='<div class="empty-state" style="color: var(--error);">加载模型使用量失败</div>'}}async updateSkillUsageStats(){const t=document.getElementById("skillUsageStats");if(!t)return;const e=document.getElementById("skillUsageRange"),i=e?e.value:"7",s=i?`days=${i}`:"";e&&!e._bound&&(e._bound=!0,e.addEventListener("change",()=>{this.panelRefreshState.skillUsage=0,this.updateSkillUsageStats()}));try{const a=await H(`/api/skills/usage?${s}`),n=a.summary||{},l=a.skillReads||[],r=a.skillExecs||[],m=a.findings||[],x=`<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom: 14px;">
        <div style="padding:12px; border-radius:10px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#3b82f6;">${(n.totalToolCalls||0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">总工具调用</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#10b981;">${(n.skillReads||0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">技能说明读取</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#8b5cf6;">${(n.skillExecs||0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">技能实际执行</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#f59e0b;">${n.execSkillUsageRate||0}%</div><div style="font-size:0.78em; color:var(--text-secondary);">exec技能命中率</div></div>
      </div>`,c=(u,f)=>!u||u.length===0?`<div class="empty-state">${f}</div>`:u.slice(0,8).map(T=>`<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-secondary); border-radius:8px; margin-bottom:6px;"><span style="font-size:0.86em; color:var(--text-primary);">${g(T.name)}</span><span style="font-size:0.82em; color:var(--text-secondary); font-weight:600;">${T.count}</span></div>`).join(""),d=m.length>0?`<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(239,68,68,0.18); background:rgba(239,68,68,0.04);"><div style="font-size:0.84em; font-weight:600; color:#ef4444; margin-bottom:6px;">⚠️ 待改进</div>${m.map(u=>`<div style="font-size:0.8em; color:var(--text-secondary); margin-bottom:4px;">• ${g(u)}</div>`).join("")}</div>`:'<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(16,185,129,0.18); background:rgba(16,185,129,0.04); font-size:0.82em; color:#10b981;">✅ 统计窗口内未发现技能使用缺口</div>';t.innerHTML=`${x}<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;"><div style="padding:12px; border-radius:10px; border:1px solid rgba(59,130,246,0.18); background:rgba(59,130,246,0.03);"><div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">📘 技能说明读取</div>${c(l,"暂无读取记录")}</div><div style="padding:12px; border-radius:10px; border:1px solid rgba(139,92,246,0.18); background:rgba(139,92,246,0.03);"><div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">⚙️ 技能实际执行</div>${c(r,"暂无执行记录")}</div></div>${d}`,window._dragDrop&&window._dragDrop.layoutMasonry&&window._dragDrop.layoutMasonry()}catch(a){console.error("更新技能使用统计失败:",a),t.innerHTML='<div class="empty-state" style="color: var(--error);">加载技能统计失败</div>'}}updateLogs(){this._logUpdatePending||(this._logUpdatePending=!0,this.addTimeout(async()=>{try{const t=document.getElementById("logContainer");if(!t){this._logUpdatePending=!1;return}const e=await H("/api/logs/recent?count=50");if(window._searchManager)window._searchManager.updateLogsCache(e);else if(!Array.isArray(e)||e.length===0)t.innerHTML='<div class="empty-state">暂无日志</div>';else{const i=e.map(a=>{const n=a.level==="error"?"log-error":a.level==="warn"?"log-warn":"log-info",l=new Date(a.timestamp).toLocaleTimeString("zh-CN");return`<div class="log-entry ${n}"><span class="log-time">${l}</span>${g(a.message)}</div>`}).join(""),s=t.scrollHeight-t.scrollTop<=t.clientHeight+10;t.innerHTML=i,this.autoScroll&&s&&(t.scrollTop=t.scrollHeight)}}catch(t){console.error("更新日志失败:",t);const e=document.getElementById("logContainer");e&&(e.innerHTML='<div class="empty-state" style="color: var(--error);">日志加载失败</div>')}finally{this._logUpdatePending=!1}},1e3))}async _updateResourcesPanel(){const t=document.getElementById("resourcesContent");if(t)try{const e=await H("/api/system/resources"),i=e&&e.system;if(!i||!i.cpu||!i.memory||!i.disk||!i.network){t.innerHTML='<div class="empty-state">资源数据不可用</div>';return}t.innerHTML=`<div class="stats-grid"><div class="stat-card"><div class="stat-value">${(i.cpu.usage??0).toFixed(1)}%</div><div class="stat-label">CPU使用率</div></div><div class="stat-card"><div class="stat-value">${(i.memory.percent??0).toFixed(1)}%</div><div class="stat-label">内存使用率</div></div><div class="stat-card"><div class="stat-value">${(i.disk.percent??0).toFixed(1)}%</div><div class="stat-label">磁盘使用率</div></div></div><div style="margin-top: 20px;"><h3 style="margin-bottom: 10px;">详细信息</h3><div class="status-item"><span class="status-label">CPU核心数</span><span class="status-value">${i.cpu.cores??"--"}</span></div><div class="status-item"><span class="status-label">总内存</span><span class="status-value">${(i.memory.total??0).toFixed(0)} MB</span></div><div class="status-item"><span class="status-label">已用内存</span><span class="status-value">${(i.memory.used??0).toFixed(0)} MB</span></div><div class="status-item"><span class="status-label">总磁盘</span><span class="status-value">${(i.disk.total??0).toFixed(1)} GB</span></div><div class="status-item"><span class="status-label">已用磁盘</span><span class="status-value">${(i.disk.used??0).toFixed(1)} GB</span></div><div class="status-item"><span class="status-label">网络输入</span><span class="status-value">${(i.network.input??0).toFixed(2)} MB</span></div><div class="status-item"><span class="status-label">网络输出</span><span class="status-value">${(i.network.output??0).toFixed(2)} MB</span></div></div>`}catch(e){console.error("更新资源监控失败:",e)}}async _updateAlertsPanel(){const t=document.getElementById("alertsContent");if(t)try{const[e,i]=await Promise.all([fetch("/api/alerts/active").then(a=>a.ok?a.json():[]),fetch("/api/alerts/history?limit=20").then(a=>a.ok?a.json():[])]);let s='<h3 style="margin-bottom: 15px;">活跃告警</h3>';e.length===0?s+='<div class="empty-state">暂无活跃告警</div>':(s+='<div class="compact-list">',e.forEach(a=>{const n=a.severity==="critical"?"badge-red":a.severity==="warning"?"badge-yellow":"badge-blue";s+=`<div class="compact-list-item"><div><span class="badge ${n}">${g(a.severity)}</span><strong style="margin-left: 10px;">${g(a.ruleName)}</strong></div><div style="font-size: 0.85em; color: var(--text-secondary);">${new Date(a.timestamp).toLocaleString("zh-CN")}</div></div>`}),s+="</div>"),s+='<h3 style="margin-top: 30px; margin-bottom: 15px;">告警历史</h3>',i.length===0?s+='<div class="empty-state">暂无告警历史</div>':(s+='<div class="compact-list">',i.slice(0,10).forEach(a=>{const n=a.severity==="critical"?"badge-red":a.severity==="warning"?"badge-yellow":"badge-blue",l=a.resolved?'<span class="badge badge-green">已解决</span>':"";s+=`<div class="compact-list-item"><div><span class="badge ${n}">${g(a.severity)}</span><strong style="margin-left: 10px;">${g(a.ruleName)}</strong>${l}</div><div style="font-size: 0.85em; color: var(--text-secondary);">${new Date(a.timestamp).toLocaleString("zh-CN")}</div></div>`}),s+="</div>"),t.innerHTML=s}catch(e){console.error("更新告警面板失败:",e)}}async _updateStatisticsPanel(){const t=document.getElementById("statisticsContent");if(t)try{const[e,i,s]=await Promise.all([fetch("/api/statistics?range=today").then(n=>n.ok?n.json():null),fetch("/api/statistics?range=week").then(n=>n.ok?n.json():null),fetch("/api/statistics?range=month").then(n=>n.ok?n.json():null)]),a=(n,l)=>l?`<div class="card compact"><h3 style="margin-bottom: 15px;">${n}</h3><div class="stat-card"><div class="stat-value">${l.tasks.total}</div><div class="stat-label">任务总数</div></div><div class="stat-card"><div class="stat-value">${l.messages?.total||0}</div><div class="stat-label">消息总数</div></div></div>`:"";t.innerHTML=`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">${a("今日统计",e)}${a("本周统计",i)}${a("本月统计",s)}</div>`}catch(e){console.error("更新统计面板失败:",e)}}async _updateMessagesPanel(){const t=document.getElementById("messagesContent");if(t)try{const e=await H("/api/messages/stream?limit=50&compact=1");if(e.messages.length===0){t.innerHTML='<div class="empty-state">暂无消息</div>';return}const i=e.messages.map(s=>`
        <div class="message-item message-${s.role||"user"}">
          <div class="message-header"><span class="message-role">${g(s.agentName||"系统")}</span><span class="message-time">${new Date(s.timestamp).toLocaleString("zh-CN")}</span></div>
          <div class="message-content">${g(s.content||s.text||"")}</div>
        </div>`).join("");t.innerHTML=`<div class="messages-container">${i}</div>`}catch(e){console.error("更新消息流失败:",e)}}}const N=[];document.addEventListener("DOMContentLoaded",async()=>{const y=new Jt;y.init(),window._notificationCenter=y,N.push(y);const t=new Xt;window.dashboard=t,N.push(t),await t.init(),requestIdleCallback(async()=>{const[{ThemeManager:r},{FullscreenManager:m},{KeyboardShortcuts:x},{DragDropManager:c},{MobileNavManager:d}]=await Promise.all([L(()=>import("./theme-Bm7Lt_-O.js"),[]),L(()=>import("./fullscreen-CsZyb2Sg.js"),[]),L(()=>import("./keyboard-shortcuts-C2jUTCQl.js"),[]),L(()=>import("./drag-drop-C3-YWfjA.js"),[]),L(()=>import("./mobile-nav-AlewzsWU.js"),[])]),u=new r;u.loadTheme(),u.setupThemeToggle(),N.push(u);const f=new m;f.setup(),N.push(f);const T=new x({fullscreenManager:f,themeManager:u});T.setup(),N.push(T);const B=new c;B.setupDragAndDrop(),window._dragDrop=B,N.push(B);const E=new d;E.setup(),N.push(E)});const[{SearchManager:e},{SidebarManager:i}]=await Promise.all([L(()=>import("./search-B0V0IEO0.js"),[]),L(()=>import("./sidebar-BjgbIv6C.js"),[])]),s=new e;s.init(),s.setDashboardData(t.data),window._searchManager=s,window.searchManager=s,N.push(s);const a=new i;window._sidebarManager=a,window.sidebarManager=a,N.push(a);const[{showAgentDetail:n},{showTaskDetail:l}]=await Promise.all([L(()=>import("./agent-detail-Dlq68Rxg.js"),[]),L(()=>import("./task-detail-rmNZ4Np0.js"),[])]);window.showAgentDetail=n,window.showTaskDetail=l});window.addEventListener("beforeunload",()=>{N.forEach(y=>{y.dispose&&y.dispose()})});export{st as D,I as b,g as e};
