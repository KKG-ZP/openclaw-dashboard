import{D as y,e as d}from"./index-B7Gx8lv1.js";class x extends y{constructor(){super(),this.modal=document.getElementById("agentDetailModal"),this.content=document.getElementById("agentDetailContent"),this.title=document.getElementById("agentDetailTitle"),this.currentAgentId=null,this._sessionModalOpen=!1,this._sessionModalEl=null,this._sessionStyleEl=null,!(!this.modal||!this.content||!this.title)&&this.setupEventListeners()}setupEventListeners(){const s=document.getElementById("closeAgentDetail");s&&this.addListener(s,"click",()=>this.close()),this.addListener(this.modal,"click",e=>{e.target===this.modal&&this.close()}),this.addListener(document,"keydown",e=>{e.key==="Escape"&&(this._sessionModalOpen?this.hideSessionDetail():this.modal.style.display==="block"&&this.close())}),this.addCleanup(()=>{this._sessionModalEl&&this._sessionModalEl.parentNode&&this._sessionModalEl.parentNode.removeChild(this._sessionModalEl),this._sessionStyleEl&&this._sessionStyleEl.parentNode&&this._sessionStyleEl.parentNode.removeChild(this._sessionStyleEl)})}async show(s){if(!(!this.modal||!this.content)){this.modal.style.display="block",this.content.innerHTML='<div class="loading">加载中...</div>';try{const e=await fetch(`/api/agents/${s}/details`);if(!e.ok)throw new Error(`HTTP错误: ${e.status}`);const i=await e.json();this.render(i)}catch(e){console.error("加载Agent详情失败:",e),this.content.innerHTML=`
        <div class="error-state">
          <div style="font-size: 1.2em; margin-bottom: 8px;">加载失败</div>
          <div style="font-size: 0.9em; color: var(--text-secondary);">${d(e.message)}</div>
        </div>
      `}}}getOrganizationMeta(s,e){const i={"command-center":{label:"作战指挥中心",color:"#7c3aed",background:"rgba(124, 58, 237, 0.12)",border:"rgba(124, 58, 237, 0.22)",icon:"🧭"},"direct-department":{label:"直属部门",color:"#2563eb",background:"rgba(37, 99, 235, 0.12)",border:"rgba(37, 99, 235, 0.22)",icon:"🏛️"},"special-envoy":{label:"特使机构",color:"#d97706",background:"rgba(217, 119, 6, 0.12)",border:"rgba(217, 119, 6, 0.22)",icon:"📜"},"managed-agent":{label:"下级 Agent",color:"#0f766e",background:"rgba(15, 118, 110, 0.12)",border:"rgba(15, 118, 110, 0.22)",icon:"🧩"},"runtime-subagent":{label:"下级 Agent",color:"#0f766e",background:"rgba(15, 118, 110, 0.12)",border:"rgba(15, 118, 110, 0.22)",icon:"🧩"},independent:{label:"独立实例",color:"#6b7280",background:"rgba(107, 114, 128, 0.12)",border:"rgba(107, 114, 128, 0.22)",icon:"🛰️"}},l=i[s]||i["managed-agent"];return{...l,label:e||l.label}}renderOrganizationBadge(s,e){const i=this.getOrganizationMeta(s,e);return`
      <span class="badge" style="background: ${i.background}; color: ${i.color}; border: 1px solid ${i.border};">
        ${i.icon} ${i.label}
      </span>
    `}renderOrganizationChildren(s){if(!s||s.length===0)return"";const e=new Map,i=["direct-department","special-envoy","managed-agent","runtime-subagent","independent"];return s.forEach(t=>{const a=t.organizationType||"managed-agent";e.has(a)||e.set(a,[]),e.get(a).push(t)}),`
      <div class="detail-section">
        <h3>组织成员</h3>
        ${i.filter(t=>e.has(t)).map(t=>{const a=this.getOrganizationMeta(t),n=e.get(t)||[],r=n.map(o=>`
          <div class="clickable" onclick="showAgentDetail('${o.id}')" style="
            padding: 10px 12px;
            border-radius: 12px;
            background: ${a.background};
            border: 1px solid ${a.border};
            cursor: pointer;
            min-width: 220px;
            transition: all 0.2s;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 18px rgba(0,0,0,0.08)';"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.1em;">${o.emoji||"🤖"}</span>
              <span style="font-weight: 600; color: var(--text-primary);">${d(o.name||o.id)}</span>
            </div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 4px;">${d(o.id)}</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <span class="badge badge-blue">${d(o.role||"助手")}</span>
              <span class="badge ${o.status==="active"?"badge-green":"badge-yellow"}">${o.status==="active"?"活跃":"空闲"}</span>
              <span class="badge" style="background: rgba(15, 23, 42, 0.06); color: var(--text-secondary);">${o.sessionCount||0} 会话</span>
            </div>
          </div>
        `).join("");return`
          <div style="margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.9em; font-weight: 600; color: ${a.color};">
              <span>${a.icon}</span>
              <span>${a.label} (${n.length})</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              ${r}
            </div>
          </div>
        `}).join("")}
      </div>
    `}render(s){this.title&&(this.title.textContent=`${s.emoji||""} ${s.name} - 详情`);const e=this.renderOrganizationBadge(s.organizationType,s.organizationLabel),i=this.renderOrganizationChildren(s.organizationChildren||[]),l=`
      <div class="detail-section">
        <h3>基本信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Agent ID</span>
            <span class="detail-value">${s.id}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">名称</span>
            <span class="detail-value">${s.name}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">组织类型</span>
            <span class="detail-value">${e}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="badge ${s.status==="active"?"badge-green":"badge-yellow"}">
              ${s.status==="active"?"活跃":"空闲"}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">模型</span>
            <span class="detail-value">${s.model}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">工作空间</span>
            <span class="detail-value">${s.workspace}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">上级机构</span>
            <span class="detail-value">${s.parentId||"无"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">会话数</span>
            <span class="detail-value">${s.sessionCount}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">总消息数</span>
            <span class="detail-value">${s.totalMessages}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最后活动</span>
            <span class="detail-value">${s.lastActivity?new Date(s.lastActivity).toLocaleString("zh-CN"):"N/A"}</span>
          </div>
        </div>
      </div>

      ${i}

      <div class="detail-section">
        <h3>配置信息</h3>
        <div class="config-info">
          <div class="config-item">
            <span class="config-label">系统提示词</span>
            <div class="config-value">${d(s.config&&s.config.systemPrompt||"未配置")}</div>
          </div>
          <div class="config-item">
            <span class="config-label">温度</span>
            <span class="config-value">${(s.config&&s.config.temperature)??"N/A"}</span>
          </div>
          <div class="config-item">
            <span class="config-label">最大Token数</span>
            <span class="config-value">${(s.config&&s.config.maxTokens)??"N/A"}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>会话列表 (最近${(s.sessions||[]).length}个)</h3>
        <div class="sessions-list">
          ${(s.sessions||[]).length>0?(s.sessions||[]).map(t=>`
            <div class="session-item clickable" onclick="showAgentDetail._instance.showSession('${s.id}', '${t.id}')" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'; this.style.transform='translateX(4px)';" onmouseout="this.style.background=''; this.style.transform='';">
              <div class="session-header">
                <span class="session-id">🗂️ ${t.id.substring(0,16)}...</span>
                <span class="badge badge-info">${t.messageCount} 条消息</span>
                <span style="margin-left: auto; font-size: 0.8em; color: var(--accent);">点击查看 →</span>
              </div>
              <div class="session-info">
                <div>创建: ${new Date(t.createdAt).toLocaleString("zh-CN")}</div>
                <div>更新: ${new Date(t.updatedAt).toLocaleString("zh-CN")}</div>
              </div>
              <div class="session-preview">
                <div class="preview-label">首条:</div>
                <div class="preview-content">${d(String(t.firstMessage||"")).substring(0,80)}${(t.firstMessage||"").length>80?"...":""}</div>
              </div>
            </div>
          `).join(""):'<div class="empty-state">暂无会话</div>'}
        </div>
      </div>
    `;this.content.innerHTML=l,this.currentAgentId=s.id}async showSession(s,e){if(!this._sessionModalEl){this._sessionModalEl=document.createElement("div"),this._sessionModalEl.id="sessionDetailModal",this._sessionModalEl.innerHTML=`
        <div class="session-modal-overlay"></div>
        <div class="session-modal-content">
          <div class="session-modal-header">
            <h2 id="sessionModalTitle">会话详情</h2>
            <button class="session-modal-close" id="sessionModalCloseBtn">&times;</button>
          </div>
          <div class="session-modal-body" id="sessionModalBody">
            <div class="loading">加载中...</div>
          </div>
        </div>
      `,document.body.appendChild(this._sessionModalEl);const t=this._sessionModalEl.querySelector(".session-modal-overlay"),a=this._sessionModalEl.querySelector("#sessionModalCloseBtn");t&&this.addListener(t,"click",()=>this.hideSessionDetail()),a&&this.addListener(a,"click",()=>this.hideSessionDetail()),this._sessionStyleEl=document.createElement("style"),this._sessionStyleEl.textContent=`
        #sessionDetailModal {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
        }
        #sessionDetailModal .session-modal-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        #sessionDetailModal .session-modal-content {
          position: absolute;
          top: 3%; left: 5%; right: 5%; bottom: 3%;
          background: var(--card-bg, #fff);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }
        #sessionDetailModal .session-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--bg-secondary, #f8fafc);
        }
        #sessionDetailModal .session-modal-header h2 {
          margin: 0;
          font-size: 1.1em;
          color: var(--text-primary, #1e293b);
        }
        #sessionDetailModal .session-modal-close {
          width: 36px; height: 36px;
          border: none;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 1.5em;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        #sessionDetailModal .session-modal-close:hover {
          background: #ef4444;
          color: white;
        }
        #sessionDetailModal .session-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .message-item {
          margin-bottom: 16px; padding: 16px;
          border-radius: 12px; border-left: 4px solid;
        }
        .message-item.user {
          background: rgba(59, 130, 246, 0.08);
          border-left-color: #3b82f6;
        }
        .message-item.assistant {
          background: rgba(16, 185, 129, 0.08);
          border-left-color: #10b981;
        }
        .message-item.system {
          background: rgba(245, 158, 11, 0.08);
          border-left-color: #f59e0b;
        }
        .message-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .message-icon { font-size: 1.3em; }
        .message-role { font-weight: 600; font-size: 0.9em; }
        .message-meta {
          margin-left: auto; font-size: 0.75em;
          color: var(--text-secondary, #64748b);
        }
        .message-content {
          font-size: 0.95em; line-height: 1.7;
          white-space: pre-wrap; word-break: break-word;
        }
      `,document.head.appendChild(this._sessionStyleEl)}this._sessionModalEl.style.display="block",this._sessionModalOpen=!0;const i=document.getElementById("sessionModalTitle"),l=document.getElementById("sessionModalBody");i&&(i.textContent=`📝 会话: ${e.substring(0,24)}...`),l&&(l.innerHTML='<div class="loading">加载消息中...</div>');try{const t=await fetch(`/api/agents/${s}/sessions/${e}`);if(!t.ok)throw new Error(`HTTP错误: ${t.status}`);const a=await t.json();this.renderSessionMessages(a.messages,{agentName:a.agentName,agentEmoji:a.agentEmoji,agentRole:a.agentRole})}catch(t){console.error("加载会话详情失败:",t);const a=document.getElementById("sessionModalBody");a&&(a.innerHTML=`<div class="error-state">加载失败: ${d(t.message)}</div>`)}}renderSessionMessages(s,e={}){const i=document.getElementById("sessionModalBody");if(!i)return;if(!s||s.length===0){i.innerHTML='<div class="empty-state">暂无消息</div>';return}const t=[...s].sort((n,r)=>{const o=n.timestamp?new Date(n.timestamp).getTime():0;return(r.timestamp?new Date(r.timestamp).getTime():0)-o}).map((n,r)=>{const o=n.role==="user",c=n.role==="assistant";let m="system";o?m="user":c&&(m="assistant");const v=n.senderEmoji||(o?"👤":c?"🤖":"⚙️"),h=n.senderName||(o?"用户":c?"助手":"系统"),u=n.content||n.text||n.message?.content||JSON.stringify(n).substring(0,500),f=n.timestamp?new Date(n.timestamp).toLocaleString("zh-CN"):"";return`
        <div class="message-item ${m}">
          <div class="message-header">
            <span class="message-icon">${v}</span>
            <span class="message-role">${h}</span>
            <span class="message-meta">#${r+1} · ${f}</span>
          </div>
          <div class="message-content">${d(String(u))}</div>
        </div>
      `}).join(""),a=e.agentName?`<span style="margin-left: 16px; color: var(--text-secondary);">${e.agentEmoji||"🤖"} ${e.agentName}</span>`:"";i.innerHTML=`
      <div style="margin-bottom: 16px; padding: 12px 16px; background: var(--bg-secondary, #f1f5f9); border-radius: 10px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.2em;">📊</span>
        <span style="font-weight: 500;">共 ${s.length} 条消息</span>
        ${a}
      </div>
      ${t}
    `}hideSessionDetail(){this._sessionModalEl&&(this._sessionModalEl.style.display="none"),this._sessionModalOpen=!1}close(){this.modal&&(this.modal.style.display="none")}}let p=null;function b(g){p||(p=new x),p.show(g)}b._instance=null;Object.defineProperty(b,"_instance",{get(){return p}});export{x as AgentDetail,b as showAgentDetail};
