import{D as d,e as n}from"./index-B7Gx8lv1.js";class c extends d{constructor(){super(),this.modal=document.getElementById("taskDetailModal"),this.content=document.getElementById("taskDetailContent"),this.title=document.getElementById("taskDetailTitle"),!(!this.modal||!this.content||!this.title)&&this.setupEventListeners()}setupEventListeners(){const s=document.getElementById("closeTaskDetail");s&&this.addListener(s,"click",()=>this.close()),this.addListener(this.modal,"click",e=>{e.target===this.modal&&this.close()}),this.addListener(document,"keydown",e=>{e.key==="Escape"&&this.modal.style.display==="block"&&this.close()})}async show(s){if(!(!this.modal||!this.content)){this.modal.style.display="block",this.content.innerHTML='<div class="loading">加载中...</div>';try{const e=await fetch(`/api/tasks/${s}/details`);if(!e.ok)throw new Error(`HTTP错误: ${e.status}`);const a=await e.json();this.render(a)}catch(e){console.error("加载任务详情失败:",e),this.content.innerHTML=`
        <div class="error-state">
          <div style="font-size: 1.2em; margin-bottom: 8px;">加载失败</div>
          <div style="font-size: 0.9em; color: var(--text-secondary);">${n(e.message)}</div>
        </div>
      `}}}render(s){const e=s.title||"(无标题)";this.title&&(this.title.textContent=`📌 ${e}`);const a=`
      <div class="detail-section">
        <h3>任务信息</h3>
        <div class="detail-grid">
          <div class="detail-item" style="grid-column: span 2;">
            <span class="detail-label">任务标题</span>
            <span class="detail-value" style="font-weight: 600; font-size: 1.05em;">${this.formatMessage(e)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">任务ID</span>
            <span class="detail-value">${s.id}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Agent</span>
            <span class="detail-value">${s.agentName} (${s.agentId})</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="badge ${s.status==="completed"?"badge-green":"badge-blue"}">
              ${s.status==="completed"?"已完成":"进行中"}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">消息数</span>
            <span class="detail-value">${s.messageCount}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">${new Date(s.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">完成时间</span>
            <span class="detail-value">${s.completedAt?new Date(s.completedAt).toLocaleString("zh-CN"):"N/A"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">执行时长</span>
            <span class="detail-value">${s.duration}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>消息统计</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${s.summary?s.summary.userMessages:0}</div>
            <div class="stat-label">用户消息</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${s.summary?s.summary.assistantMessages:0}</div>
            <div class="stat-label">助手消息</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${s.summary?s.summary.systemMessages:0}</div>
            <div class="stat-label">系统消息</div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>消息历史</h3>
        <div class="messages-container">
          ${(s.messages||[]).length>0?(s.messages||[]).map((t,o)=>`
            <div class="message-item message-${t.role}">
              <div class="message-header">
                <span class="message-role">${t.senderEmoji||this.getRoleEmoji(t.role)} ${t.senderName||this.getRoleName(t.role)}</span>
                <span class="message-time">${t.timestamp?new Date(t.timestamp).toLocaleString("zh-CN"):""}</span>
              </div>
              <div class="message-content">${this.formatMessage(t.content)}</div>
            </div>
          `).join(""):'<div class="empty-state">暂无消息</div>'}
        </div>
      </div>
    `;this.content.innerHTML=a}getRoleLabel(s){return{user:"👤 用户",assistant:"🤖 助手",system:"⚙️ 系统"}[s]||s}getRoleEmoji(s){return{user:"👤",assistant:"🤖",system:"⚙️"}[s]||"💬"}getRoleName(s){return{user:"用户",assistant:"助手",system:"系统"}[s]||s}formatMessage(s){return s?n(s).replace(/\n/g,"<br>"):"<em>空消息</em>"}close(){this.modal&&(this.modal.style.display="none")}}let i=null;function r(l){i||(i=new c),i.show(l)}export{c as TaskDetail,r as showTaskDetail};
