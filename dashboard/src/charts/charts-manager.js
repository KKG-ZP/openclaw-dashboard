/**
 * Charts Manager — ES module 化，启用 Chart.js tree-shaking
 * 只导入实际使用的组件（Line + Bar + Doughnut）
 */
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  Title
} from 'chart.js';
import { Disposable } from '../core/disposable.js';

// 注册使用的组件
Chart.register(
  LineController, BarController, DoughnutController,
  LineElement, BarElement, ArcElement, PointElement,
  LinearScale, CategoryScale,
  Tooltip, Legend, Filler, Title
);

export class ChartsManager extends Disposable {
  constructor() {
    super();
    this.charts = {};
  }

  init() {
    this.initMetricsChart();
    this.initTasksChart();
    this.initModelsChart();
    this.initHealthChart();
  }

  destroyChart(chartId) {
    if (this.charts[chartId]) {
      this.charts[chartId].destroy();
      delete this.charts[chartId];
    }
  }

  // ========== 性能趋势图 ==========
  async initMetricsChart() {
    const canvas = document.getElementById('metricsChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('metricsChart');
    if (!container) return;

    try {
      const response = await fetch('/api/metrics/history?hours=24');
      if (!response.ok) return;
      const data = await response.json();

      this.destroyChart('metrics');

      this.charts.metrics = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels || [],
          datasets: [
            {
              label: 'CPU使用率 (%)',
              data: data.cpu || [],
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4, fill: true, yAxisID: 'y',
              pointRadius: 0, pointHoverRadius: 3, borderWidth: 1.5
            },
            {
              label: '内存使用 (MB)',
              data: data.memory || [],
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4, fill: true, yAxisID: 'y1',
              pointRadius: 0, pointHoverRadius: 3, borderWidth: 1.5
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            title: { display: true, text: '性能趋势（最近24小时）', font: { size: 14 } },
            legend: { display: true, position: 'top' }
          },
          scales: {
            x: { ticks: { maxTicksLimit: 12, font: { size: 10 } } },
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'CPU (%)' }, min: 0, max: 100 },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '内存 (MB)' }, grid: { drawOnChartArea: false } }
          }
        }
      });
      container.style.display = 'block';
      requestAnimationFrame(() => { if (this.charts.metrics) this.charts.metrics.resize(); });
    } catch (error) {
      console.error('初始化性能趋势图失败:', error);
    }
  }

  async updateMetricsChart() {
    if (!this.charts.metrics) { await this.initMetricsChart(); return; }
    try {
      const response = await fetch('/api/metrics/history?hours=24');
      const data = await response.json();
      this.charts.metrics.data.labels = data.labels || [];
      this.charts.metrics.data.datasets[0].data = data.cpu || [];
      this.charts.metrics.data.datasets[1].data = data.memory || [];
      this.charts.metrics.update('none');
    } catch (error) { console.error('更新性能趋势图失败:', error); }
  }

  // ========== 消息统计图 ==========
  async initChannelsChart(range = 'today') {
    const canvas = document.getElementById('channelsChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('channelsChart');
    if (!container) return;

    try {
      const response = await fetch(`/api/channels/stats?range=${range}`);
      const data = await response.json();
      this.destroyChart('channels');

      this.charts.channels = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels || [],
          datasets: [{
            label: '消息数量', data: data.data || [],
            backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)', 'rgba(139,92,246,0.8)'],
            borderColor: ['rgb(59,130,246)', 'rgb(16,185,129)', 'rgb(245,158,11)', 'rgb(239,68,68)', 'rgb(139,92,246)'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: `通道消息统计（${range === 'today' ? '今日' : range === 'week' ? '本周' : '本月'}）`, font: { size: 14 } },
            legend: { display: false }
          },
          scales: { y: { beginAtZero: true, title: { display: true, text: '消息数量' } } }
        }
      });
      container.style.display = 'block';
      requestAnimationFrame(() => { if (this.charts.channels) this.charts.channels.resize(); });
    } catch (error) { console.error('初始化消息统计图失败:', error); }
  }

  async updateChannelsChart(range = 'today') {
    if (!this.charts.channels) { await this.initChannelsChart(range); return; }
    try {
      const response = await fetch(`/api/channels/stats?range=${range}`);
      const data = await response.json();
      this.charts.channels.data.labels = data.labels || [];
      this.charts.channels.data.datasets[0].data = data.data || [];
      this.charts.channels.options.plugins.title.text = `通道消息统计（${range === 'today' ? '今日' : range === 'week' ? '本周' : '本月'}）`;
      this.charts.channels.update();
    } catch (error) { console.error('更新消息统计图失败:', error); }
  }

  // ========== 任务执行时间分布 ==========
  async initTasksChart() {
    const canvas = document.getElementById('tasksChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('tasksChart');
    if (!container) return;

    try {
      const response = await fetch('/api/tasks/stats');
      const data = await response.json();
      this.destroyChart('tasks');

      this.charts.tasks = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels || [],
          datasets: [{ label: '任务数量', data: data.data || [], backgroundColor: 'rgba(139,92,246,0.8)', borderColor: 'rgb(139,92,246)', borderWidth: 1 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: `任务执行时间分布（平均: ${data.average}秒，总计: ${data.total}个）`, font: { size: 14 } },
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: '任务数量' } },
            x: { title: { display: true, text: '执行时间区间' } }
          }
        }
      });
      container.style.display = 'block';
      requestAnimationFrame(() => { if (this.charts.tasks) this.charts.tasks.resize(); });
    } catch (error) { console.error('初始化任务分布图失败:', error); }
  }

  async updateTasksChart() {
    if (!this.charts.tasks) { await this.initTasksChart(); return; }
    try {
      const response = await fetch('/api/tasks/stats');
      const data = await response.json();
      this.charts.tasks.data.labels = data.labels || [];
      this.charts.tasks.data.datasets[0].data = data.data || [];
      this.charts.tasks.options.plugins.title.text = `任务执行时间分布（平均: ${data.average}秒，总计: ${data.total}个）`;
      this.charts.tasks.update('none');
    } catch (error) { console.error('更新任务分布图失败:', error); }
  }

  // ========== 模型使用统计（Doughnut） ==========
  async initModelsChart() {
    const canvas = document.getElementById('modelsChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('modelsChart');
    if (!container) return;

    try {
      const response = await fetch('/api/models/stats');
      const data = await response.json();
      this.destroyChart('models');
      if (!data.labels || data.labels.length === 0) return;

      this.charts.models = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.labels || [],
          datasets: [{
            data: data.data || [],
            backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)', 'rgba(139,92,246,0.8)', 'rgba(236,72,153,0.8)', 'rgba(14,165,233,0.8)'],
            borderColor: '#ffffff', borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: '模型使用统计', font: { size: 14 } },
            legend: { display: true, position: 'right' },
            tooltip: {
              callbacks: {
                label(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${label}: ${value} (${pct}%)`;
                }
              }
            }
          }
        }
      });
      container.style.display = 'block';
      requestAnimationFrame(() => { if (this.charts.models) this.charts.models.resize(); });
    } catch (error) { console.error('初始化模型使用统计图失败:', error); }
  }

  async updateModelsChart() {
    if (!this.charts.models) { await this.initModelsChart(); return; }
    try {
      const response = await fetch('/api/models/stats');
      const data = await response.json();
      if (!data.labels || data.labels.length === 0) return;
      this.charts.models.data.labels = data.labels || [];
      this.charts.models.data.datasets[0].data = data.data || [];
      this.charts.models.update('none');
    } catch (error) { console.error('更新模型使用统计图失败:', error); }
  }

  // ========== 健康度趋势 ==========
  async initHealthChart() {
    const canvas = document.getElementById('healthChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('healthChart');
    if (!container) return;

    try {
      const response = await fetch('/api/health/history?hours=24');
      const data = await response.json();
      this.destroyChart('health');

      const borderColors = data.statuses.map(s => s === 'healthy' ? 'rgb(16,185,129)' : s === 'warning' ? 'rgb(245,158,11)' : 'rgb(239,68,68)');

      this.charts.health = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels || [],
          datasets: [{
            label: '健康度分数', data: data.scores || [],
            borderColor: 'rgb(59,130,246)', backgroundColor: 'rgba(59,130,246,0.1)',
            tension: 0.4, fill: true,
            pointBackgroundColor: borderColors, pointBorderColor: borderColors,
            pointRadius: 4, pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: '健康度趋势（最近24小时）', font: { size: 14 } },
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: '健康度分数' }, ticks: { callback: v => v + '%' } }
          }
        }
      });
      container.style.display = 'block';
      requestAnimationFrame(() => { if (this.charts.health) this.charts.health.resize(); });
    } catch (error) { console.error('初始化健康度趋势图失败:', error); }
  }

  async updateHealthChart() {
    if (!this.charts.health) { await this.initHealthChart(); return; }
    try {
      const response = await fetch('/api/health/history?hours=24');
      const data = await response.json();
      this.charts.health.data.labels = data.labels || [];
      this.charts.health.data.datasets[0].data = data.scores || [];
      const borderColors = (data.statuses || []).map(s => s === 'healthy' ? 'rgb(16,185,129)' : s === 'warning' ? 'rgb(245,158,11)' : 'rgb(239,68,68)');
      this.charts.health.data.datasets[0].pointBackgroundColor = borderColors;
      this.charts.health.data.datasets[0].pointBorderColor = borderColors;
      this.charts.health.update('none');
    } catch (error) { console.error('更新健康度趋势图失败:', error); }
  }

  // ========== 模型使用量每日趋势图 ==========
  renderModelUsageTrend(data) {
    const canvas = document.getElementById('modelUsageTrendCanvas');
    if (!canvas || !data.byDay || data.byDay.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.modelUsageTrend && this.charts.modelUsageTrend.canvas !== canvas) {
      this.destroyChart('modelUsageTrend');
    }

    const colors = ['rgb(59,130,246)', 'rgb(16,185,129)', 'rgb(245,158,11)', 'rgb(239,68,68)', 'rgb(139,92,246)', 'rgb(236,72,153)', 'rgb(6,182,212)', 'rgb(132,204,22)', 'rgb(249,115,22)', 'rgb(99,102,241)'];
    const bgColors = colors.map(c => c.replace('rgb', 'rgba').replace(')', ',0.1)'));

    const modelTotals = {};
    data.byDay.forEach(day => {
      Object.entries(day.counts).forEach(([key, count]) => {
        modelTotals[key] = (modelTotals[key] || 0) + count;
      });
    });
    const topModels = Object.entries(modelTotals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);

    const nameMap = {};
    if (data.byModel) {
      data.byModel.forEach(m => { nameMap[`${m.provider}/${m.modelId}`] = m.modelName; });
    }

    const labels = data.byDay.map(d => { const p = d.date.split('-'); return `${p[1]}/${p[2]}`; });
    const datasets = topModels.map((modelKey, i) => ({
      label: nameMap[modelKey] || modelKey.split('/').pop(),
      data: data.byDay.map(day => day.counts[modelKey] || 0),
      borderColor: colors[i % colors.length],
      backgroundColor: bgColors[i % bgColors.length],
      tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 1.5
    }));

    if (!this.charts.modelUsageTrend) {
      this.charts.modelUsageTrend = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { footer: items => `合计: ${items.reduce((s, i) => s + i.parsed.y, 0)} 次` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 }, callback: v => Number.isInteger(v) ? v : '' }, title: { display: true, text: '调用次数', font: { size: 11 } } }
          }
        }
      });
      return;
    }

    this.charts.modelUsageTrend.data.labels = labels;
    this.charts.modelUsageTrend.data.datasets = datasets;
    this.charts.modelUsageTrend.update('none');
  }

  renderModelTokenTrend(data) {
    const canvas = document.getElementById('modelTokenTrendCanvas');
    if (!canvas || !data.byDay || data.byDay.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (this.charts.modelTokenTrend && this.charts.modelTokenTrend.canvas !== canvas) {
      this.destroyChart('modelTokenTrend');
    }

    const labels = data.byDay.map(d => {
      const parts = d.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const tokenData = data.byDay.map(d => d.totalTokens || 0);

    if (!this.charts.modelTokenTrend) {
      this.charts.modelTokenTrend = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Token 用量',
            data: tokenData,
            backgroundColor: 'rgba(139, 92, 246, 0.5)',
            borderColor: 'rgb(139, 92, 246)',
            borderWidth: 1,
            borderRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed.y;
                  return value >= 1000000 ? `${(value / 1000000).toFixed(2)}M tokens`
                    : value >= 1000 ? `${(value / 1000).toFixed(1)}K tokens`
                    : `${value} tokens`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } }
            },
            y: {
              beginAtZero: true,
              ticks: {
                font: { size: 10 },
                callback(value) {
                  return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M`
                    : value >= 1000 ? `${(value / 1000).toFixed(0)}K`
                    : value;
                }
              },
              title: { display: true, text: 'Tokens', font: { size: 11 } }
            }
          }
        }
      });
      return;
    }

    this.charts.modelTokenTrend.data.labels = labels;
    this.charts.modelTokenTrend.data.datasets[0].data = tokenData;
    this.charts.modelTokenTrend.update('none');
  }

  async updateAllCharts() {
    await Promise.all([
      this.updateMetricsChart(),
      this.updateTasksChart(),
      this.updateModelsChart(),
      this.updateHealthChart()
    ]);
  }

  dispose() {
    Object.keys(this.charts).forEach(key => this.destroyChart(key));
    super.dispose();
  }
}
