(function () {
  "use strict";

  var chartInstances = {};
  var shadowPluginRegistered = false;
  var palette = [
    "#00826f",
    "#e07b39",
    "#3478f6",
    "#8c5cf4",
    "#39b56a",
    "#d85366",
    "#4eb9cd",
    "#f0b23f"
  ];

  function ensureShadowPlugin() {
    if (shadowPluginRegistered || typeof Chart === "undefined") {
      return;
    }
    Chart.register({
      id: "softShadow",
      beforeDatasetDraw: function (chart, args, pluginOptions) {
        if (!pluginOptions || pluginOptions.enabled === false) {
          return;
        }
        chart.ctx.save();
        chart.ctx.shadowColor = pluginOptions.color || "rgba(0,0,0,0.24)";
        chart.ctx.shadowBlur = pluginOptions.blur || 14;
        chart.ctx.shadowOffsetX = pluginOptions.offsetX || 0;
        chart.ctx.shadowOffsetY = pluginOptions.offsetY || 6;
      },
      afterDatasetDraw: function (chart, args, pluginOptions) {
        if (!pluginOptions || pluginOptions.enabled === false) {
          return;
        }
        chart.ctx.restore();
      }
    });
    shadowPluginRegistered = true;
  }

  function getCssVariable(name, fallbackValue) {
    var value = "";
    if (typeof getComputedStyle === "function") {
      value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
    return value || fallbackValue;
  }

  function getThemeColors() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      text: getCssVariable("--text", isDark ? "#eef2ff" : "#0f172a"),
      muted: getCssVariable("--muted", isDark ? "#6b7b9a" : "#64748b"),
      grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)",
      tooltipBg: isDark ? "rgba(10,14,25,0.94)" : "rgba(255,255,255,0.96)",
      tooltipBorder: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)",
      shadow: isDark ? "rgba(5,9,16,0.38)" : "rgba(51,73,121,0.16)"
    };
  }

  function hexToRgb(hex) {
    var normalized = String(hex || "").replace("#", "").trim();
    if (normalized.length === 3) {
      normalized = normalized.charAt(0) + normalized.charAt(0) +
        normalized.charAt(1) + normalized.charAt(1) +
        normalized.charAt(2) + normalized.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return { r: 16, g: 185, b: 129 };
    }
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function shiftColor(hex, amount, alpha) {
    var rgb = hexToRgb(hex);
    function shiftChannel(channel) {
      if (amount >= 0) {
        return Math.round(channel + (255 - channel) * amount);
      }
      return Math.round(channel * (1 + amount));
    }
    var r = shiftChannel(rgb.r);
    var g = shiftChannel(rgb.g);
    var b = shiftChannel(rgb.b);
    return "rgba(" + r + "," + g + "," + b + "," + (alpha == null ? 1 : alpha) + ")";
  }

  function createVerticalGradient(chart, topColor, bottomColor) {
    if (!chart || !chart.chartArea) {
      return bottomColor;
    }
    var gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    return gradient;
  }

  function formatTooltipValue(value) {
    var numeric = Number(value || 0);
    if (!isFinite(numeric)) {
      return "0";
    }
    return numeric.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function buildPluginsConfig(colors, showLegend) {
    return {
      legend: {
        display: showLegend,
        position: "bottom",
        labels: {
          color: colors.muted,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16,
          font: {
            size: 11,
            family: "'DM Sans', sans-serif"
          }
        }
      },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        titleColor: colors.text,
        bodyColor: colors.text,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: function (context) {
            var value = formatTooltipValue(context.raw);
            var label = context.label || context.dataset.label || "";
            return (label ? label + ": " : "") + value;
          }
        }
      },
      softShadow: {
        enabled: true,
        color: colors.shadow,
        blur: 14,
        offsetY: 7
      }
    };
  }

  function buildCartesianScales(colors, beginAtZero) {
    return {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: colors.muted,
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: beginAtZero,
        grid: {
          color: colors.grid,
          drawBorder: false
        },
        ticks: {
          color: colors.muted,
          callback: formatAxisTick
        }
      }
    };
  }

  function destroyChart(key) {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      chartInstances[key] = null;
    }
  }

  function formatAxisTick(value) {
    var numeric = Number(value || 0);
    var absolute = Math.abs(numeric);
    if (absolute >= 1000000) {
      return (numeric / 1000000).toFixed(1) + "m";
    }
    if (absolute >= 1000) {
      return (numeric / 1000).toFixed(0) + "k";
    }
    return numeric.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  function renderPie(data) {
    var canvas = document.getElementById("categoryPieChart");
    if (!canvas || typeof Chart === "undefined") {
      return;
    }
    ensureShadowPlugin();
    var colors = getThemeColors();
    var noData = data.labels.length === 1 && data.labels[0] === "No Data";
    var plugins = buildPluginsConfig(colors, true);

    destroyChart("pie");
    chartInstances.pie = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            backgroundColor: function (context) {
              if (noData) {
                return "rgba(107,123,154,0.35)";
              }
              var base = palette[context.dataIndex % palette.length];
              var chart = context.chart;
              if (!chart.chartArea) {
                return base;
              }
              var gradient = chart.ctx.createLinearGradient(chart.chartArea.left, chart.chartArea.top, chart.chartArea.right, chart.chartArea.bottom);
              gradient.addColorStop(0, shiftColor(base, 0.22, 0.97));
              gradient.addColorStop(1, shiftColor(base, -0.18, 0.97));
              return gradient;
            },
            borderColor: function (context) {
              if (noData) {
                return "rgba(107,123,154,0.45)";
              }
              var base = palette[context.dataIndex % palette.length];
              return shiftColor(base, -0.3, 1);
            },
            borderWidth: 1.5,
            hoverOffset: noData ? 0 : 8,
            spacing: noData ? 0 : 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: noData ? "42%" : "58%",
        animation: {
          duration: 850,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: plugins.legend,
          tooltip: plugins.tooltip,
          softShadow: plugins.softShadow
        },
        layout: {
          padding: 6
        }
      }
    });
  }

  function renderMonthlyBar(data) {
    var canvas = document.getElementById("monthlyBarChart");
    if (!canvas || typeof Chart === "undefined") {
      return;
    }
    ensureShadowPlugin();
    var colors = getThemeColors();
    var plugins = buildPluginsConfig(colors, true);
    var scales = buildCartesianScales(colors, true);

    destroyChart("monthlyBar");
    chartInstances.monthlyBar = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Income",
            data: data.incomeValues,
            backgroundColor: function (context) {
              return createVerticalGradient(context.chart, "rgba(95,228,149,0.98)", "rgba(21,131,83,0.9)");
            },
            borderRadius: 9,
            borderSkipped: false,
            maxBarThickness: 22
          },
          {
            label: "Expense",
            data: data.expenseValues,
            backgroundColor: function (context) {
              return createVerticalGradient(context.chart, "rgba(255,128,147,0.97)", "rgba(200,66,97,0.9)");
            },
            borderRadius: 9,
            borderSkipped: false,
            maxBarThickness: 22
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: "easeOutCubic"
        },
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: plugins,
        scales: {
          x: scales.x,
          y: scales.y
        },
        layout: {
          padding: 6
        }
      }
    });
  }

  function renderBalanceLine(data) {
    var canvas = document.getElementById("balanceLineChart");
    if (!canvas || typeof Chart === "undefined") {
      return;
    }
    ensureShadowPlugin();
    var colors = getThemeColors();
    var plugins = buildPluginsConfig(colors, false);
    var scales = buildCartesianScales(colors, false);

    destroyChart("balanceLine");
    chartInstances.balanceLine = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Running Balance",
            data: data.values,
            borderColor: "#5d95ff",
            borderWidth: 2.4,
            backgroundColor: function (context) {
              return createVerticalGradient(context.chart, "rgba(93,149,255,0.44)", "rgba(93,149,255,0.03)");
            },
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#7fb0ff",
            pointHitRadius: 14
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeOutQuart"
        },
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: plugins,
        scales: {
          x: scales.x,
          y: scales.y
        },
        layout: {
          padding: {
            top: 2,
            right: 6,
            left: 6,
            bottom: 2
          }
        }
      }
    });
  }

  function renderDailyPattern(data) {
    var canvas = document.getElementById("dailySpendChart");
    if (!canvas || typeof Chart === "undefined") {
      return;
    }
    ensureShadowPlugin();
    var colors = getThemeColors();
    var plugins = buildPluginsConfig(colors, false);
    var scales = buildCartesianScales(colors, true);

    destroyChart("dailyPattern");
    chartInstances.dailyPattern = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Daily Spend",
            data: data.values,
            backgroundColor: function (context) {
              return createVerticalGradient(context.chart, "rgba(255,171,110,0.96)", "rgba(220,114,49,0.9)");
            },
            borderRadius: 9,
            borderSkipped: false,
            maxBarThickness: 20
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: "easeOutCubic"
        },
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: plugins,
        scales: {
          x: scales.x,
          y: scales.y
        },
        layout: {
          padding: 6
        }
      }
    });
  }

  window.ChartService = {
    renderPie: renderPie,
    renderMonthlyBar: renderMonthlyBar,
    renderBalanceLine: renderBalanceLine,
    renderDailyPattern: renderDailyPattern
  };
})();
