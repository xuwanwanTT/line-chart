import * as d3 from 'd3';

class LineChart {
  constructor(dom) {
    this.gride = { top: 20, left: 30, right: 20, bottom: 40 };
    this.init(dom);
    this.showInfo = this.showInfo.bind(this);
  }

  init(dom) {
    const width = dom.offsetWidth;
    const height = dom.offsetHeight;
    const translateY = height - this.gride.bottom;
    this.dom = dom;
    this.svg = d3.select(dom).append('svg').attr('width', width).attr('height', height);
    this.tooltipDom = d3.select(dom).append('div');
    Object.assign(this.gride, { width, height, translateY });
  }

  setOption(options) {
    this.options = options;
    Object.assign(this.gride, options.gride || {});
    this.dealData();
    this.setAxisY(); // 画 Y 轴
    this.setAxisX(); // 画 X 轴
    this.setLine(); // 画图形
    this.setTooltip(); // 画 tooltip
    this.setEvent();
  }

  dealData() {
    let xData = [];
    let yData = [];
    const data = this.options.data;
    data.forEach((s) => {
      xData.push(s.name);
      yData.push(s.data);
    });
    const gride = this.gride;
    const width = gride.width - gride.left - gride.right;
    // 比例尺
    const scaleX = d3.scaleBand()
      .domain(xData)
      .range([0, width])
      .padding([1]);
    let max = d3.max(yData, s => Number(s));
    let min = d3.min(yData, s => Number(s));
    let minNumber = min > 0 ? 0 : min;

    let maxL = ~~Math.log(max);
    let minL = ~~Math.log(min);
    if (minL === 0) { minL = 1; }
    let tick = ~~Math.max(maxL, minL) + 2; // 获取间隔数
    let step = (max - minNumber) / tick; // 初步获取间隔长
    let magnitude = ~~(Math.log(step) / Math.log(10)); // 获取 setp 量级
    if (step !== Math.pow(10, magnitude)) { magnitude += 1; }
    let stepTemp = (step / Math.pow(10, magnitude)).toFixed(6); // 将步长值缩小到 [0, 1] 的范围
    //选取规范步长
    if (stepTemp >= 0 && stepTemp <= 0.1) {
      stepTemp = 0.1;
    } else if (stepTemp >= 0.100001 && stepTemp <= 0.2) {
      stepTemp = 0.2;
    } else if (stepTemp >= 0.200001 && stepTemp <= 0.25) {
      stepTemp = 0.25;
    } else if (stepTemp >= 0.250001 && stepTemp <= 0.3) {
      stepTemp = 0.3;
    } else if (stepTemp >= 0.250001 && stepTemp <= 0.5) {
      stepTemp = 0.5;
    } else {
      stepTemp = 1;
    }
    step = stepTemp * Math.pow(10, magnitude);

    let underZero = 0;
    if (min < 0) {
      underZero = (min % step) ? (Math.abs(~~(min / step)) + 1) : (Math.abs(~~(min / step)));
      minNumber = -underZero * step;
    }

    const height = gride.height - gride.bottom - gride.top;
    const scaleY = d3.scaleLinear()
      .domain([minNumber, step * (tick - underZero)])
      .range([0, height]);

    this.data = data;
    this.xData = xData;
    this.yData = yData;
    this.lineScaleX = scaleX;
    this.lineScaleY = scaleY;
    this.yAxis = { tick, step, min: minNumber, max: step * tick, underZero, zeroSite: scaleY(0) };
  }

  // X 轴
  setAxisX() {
    const options = this.options.axisX || {};
    const me = this;
    const gride = this.gride;
    const length = gride.translateY;
    const width = gride.width - gride.left - gride.right;
    const axisLine = Object.assign({ show: true, width: 2, color: 'black' }, options.axisLine); // 轴线
    const axisTick = Object.assign({ show: true, length: 5, width: 2, color: 'black' }, options.axisTick); // 刻度线
    const axisLabel = Object.assign({ fontSize: 14, color: 'black', unit: '' }, options.axisLabel); // 刻度文字
    const data = this.xData;
    const scale = this.lineScaleX;

    const axisX = this.svg.append('g').attr('transform', `translate(${gride.translateX},${length})`);

    let step = scale.step();
    const xSite = [];

    const tickG = axisX.selectAll('g').data(data).enter()
      .append('g');

    // 轴线
    axisX.append('g').append('path')
      .attr('d', `M0,${-this.yAxis.zeroSite} H${width}`)
      .attr('stroke-width', `${axisLine.width}px`)
      .attr('stroke', axisLine.color);

    // 刻度线
    tickG.append('path').attr('d', function (d, i) {
      xSite.push(scale(d));
      return [
        `M${scale(d)},${-me.yAxis.zeroSite} `,
        `v${axisTick.length}`
      ].join('');
    })
      .style('opacity', Number(axisTick.show))
      .attr('stroke-width', `${axisTick.width}px`)
      .attr('stroke', axisTick.color);

    // 刻度值
    tickG.append('text').text(function (d) { return d + axisLabel.unit; })
      .attr('x', function (d) {
        return scale(d);
      })
      .attr('y', function (d) {
        return axisTick.length + axisLabel.fontSize + 5;
      })
      .attr('text-anchor', 'middle')
      .style('fill', axisLabel.color)
      .style('font-size', axisLabel.fontSize);

    // 指示线
    const leaderLine = axisX.append('g').append('path')
      .attr('d', function (d, i) {
        return [
          `M0,0 `,
          `V${-(gride.height - gride.top - gride.bottom)}`
        ].join('');
      })
      .attr('stroke-width', `${axisTick.width}px`)
      .attr('stroke', axisTick.color)
      .style('opacity', '0')
      .style('transition', 'all .2s');

    this.xSite = xSite;
    this.leaderLineX = leaderLine;
  }

  // Y 轴
  setAxisY() {
    const me = this;
    const options = this.options.yAxis || {};
    const gride = this.gride;
    const length = gride.translateY;
    const height = gride.height - gride.bottom - gride.top;
    const scale = this.lineScaleY;
    const tick = this.yAxis.tick;
    const step = this.yAxis.step;
    const axisLine = Object.assign({ show: true, width: 2, color: 'black' }, options.axisLine); // 轴线
    const axisTick = Object.assign({ show: true, length: 5, width: 2, color: 'black' }, options.axisTick); // 刻度线
    const axisLabel = Object.assign({ fontSize: 14, color: 'black', unit: '' }, options.axisLabel); // 刻度文字

    const axisData = Array.from({ length: tick + 1 });

    // 创建 Y 轴 g
    const axisY = this.svg.append('g');

    const tickG = axisY.selectAll('g').data(axisData).enter()
      .append('g');

    // 轴线
    axisY.append('g').append('path')
      .attr('d', `M0,0 V${-height}`)
      .attr('stroke-width', `${axisLine.width}px`)
      .attr('stroke', axisLine.color)
      .style('opacity', Number(axisLine.show));

    // 刻度线
    tickG.append('path').attr('d', function (d, i) {
      let diff = 0;
      if (i === tick) {
        diff = axisTick.width / 2;
      } else if (i === 0 && me.yAxis.underZero) {
        diff = - axisTick.width / 2;
      } else if (i === 0) {
        diff = - axisTick.width / 2 + me.options.xAxis.axisTick.width / 2;
      }
      return [
        `M${0},${-scale(me.yAxis.min + step * i) + diff} `,
        `H${-axisTick.length}`
      ].join('');
    })
      .attr('stroke-width', `${axisTick.width}px`)
      .attr('stroke', axisTick.color)
      .style('opacity', Number(axisTick.show));

    // 刻度值
    const text = tickG.append('text').text(function (d, i) { return me.yAxis.min + step * i; });
    const textWidth = d3.max(text._groups[0], s => s.getBBox().width);

    text
      .attr('x', function (d, i) {
        return - axisTick.length - textWidth;
      })
      .attr('y', function (d, i) {
        return -scale(me.yAxis.min + step * i) + 1.5;
      })
      // .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', axisLabel.fontSize)
      .style('fill', axisLabel.color);
    // console.log(text._groups[0][tick - 1].getBBox())

    // y 轴定位
    axisY.attr('transform', `translate(${gride.left + textWidth},${length})`);
    gride.translateX = gride.left + textWidth;
    gride.diffX = textWidth;
    this.lineScaleY = scale;
  }

  // 图形
  setLine() {
    const options = this.options.shape || {};
    const data = this.data;
    const lineStyle = Object.assign({ color: 'black', width: 2 }, options.lineStyle);
    const dot = Object.assign({ show: true, size: 3.5, fillColor: 'black', borderColor: 'black', borderWidth: 1 }, options.dotStyle);
    const scaleX = this.lineScaleX;
    const scaleY = this.lineScaleY;

    // line 构造器
    const line = d3.line()
      .defined(function (d) { return d; }) // 断点判断; return boolean; false 不显示; true 显示
      .x(function (d) { return scaleX(d.name); })
      .y(function (d) { return -scaleY(Number(d.data)); })

    const shape = this.svg.append('g').attr('transform', `translate(${this.gride.translateX},${this.gride.translateY})`);

    // 线条
    const lineShape = shape.append('g').append('path')
      .attr('fill', 'none')
      .attr('stroke', lineStyle.color)
      .attr('stroke-width', `${lineStyle.width}px`)
      .attr('d', line(data));
    const length = lineShape._groups[0][0].getTotalLength();

    lineShape.attr("stroke-dasharray", length)
      .attr("stroke-dashoffset", length)
      .transition()
      .ease(d3.easeLinear)
      .duration(1500)
      .attr("stroke-dashoffset", 0);

    // 圆点
    const shapeDot = shape.append('g').selectAll('circle').data(data.filter(function (d) { return Object.assign(d, { r: dot.size }); })) // 断点判断; filter 只取有值的点
      .enter()
      .append('circle');

    shapeDot.attr("cx", line.x())
      .attr("cy", line.y())
      .attr("r", dot.size)
      .attr('fill', dot.fillColor)
      .attr('stroke', dot.color)
      .attr('stroke-width', dot.borderWidth)
      .style('opacity', 0)
      .attr('transform', function (d) {
        let x = line.x()(d);
        let y = line.y()(d);
        return `translate(${x},${y}) scale(0)`;
      })
      .transition()
      .duration(1500)
      .attr('transform', function () {
        return `translate(0,0) scale(1)`;
      })
      .style('opacity', Number(dot.show));

    this.shapeDot = shapeDot;
  }

  // tooltip
  setTooltip() {
    const options = this.options.tooltip;
    const tooltipDom = this.tooltipDom;
    const tooltip = Object.assign({ width: '', height: '', background: '#eee', border: '1px solid black', padding: '5px 10px' }, options);
    tooltipDom
      .style('width', tooltip.width)
      .style('height', tooltip.height)
      .style('position', 'absolute')
      .style('opacity', '0')
      .style('background', tooltip.background)
      .style('border', tooltip.border)
      .style('padding', tooltip.padding)
      .style('transition', 'all .1s')
      .style('pointer-events', 'none')
  }

  // 事件
  setEvent() {
    const me = this;
    this.svg.on('mousemove', me.showInfo)
      .on('mouseleave', function () {
        me.tooltipDom.style('opacity', '0');
        me.leaderLineX.style('opacity', '0');
        me.shapeDot.attr('r', function (d, i) { return d.r; });
      });
  }

  showInfo() {
    const me = this;
    const e = d3.event;
    const x = e.offsetX;
    const y = e.offsetY;
    let top = y + 20;
    let left = x + 16;
    const site = this.xSite;
    const length = site.length;
    let index = null;

    // 判断鼠标位置
    for (let i = 0; i < length - 1; i++) {
      if (!this.mouseLock) {
        if (x < (site[i + 1] + site[i]) / 2 + this.gride.left) {
          index = i;
          this.mouseLock = true;
        } else if (x > (site[length - 1] + site[length - 2]) / 2 + this.gride.left) {
          index = length - 1;
          this.mouseLock = true;
        }
      }
      if (i === length - 2) {
        this.mouseLock = false;
      }
    }

    const dom = this.tooltipDom._groups[0][0];
    const data = this.data[index];

    if (this.animateLock !== index) {
      this.animateLock = index;
      // x 指示线
      this.leaderLineX
        .style('opacity', '1')
        .attr('transform', function () {
          return `translate(${site[index]},0)`;
        });

      // 圆点 动画
      this.shapeDot.attr('r', function (d, i) {
        if (i === index) { return d.r * 1.8; } else { return d.r; }
      });

      dom.innerHTML = `<p style="white-space:nowrap;">${data.name}</p><p>${data.data}</p>`;
    }

    // tooltip
    if (x + dom.offsetWidth + 15 >= this.gride.width) { left = x - dom.offsetWidth - 16; }
    if (y + dom.offsetHeight + 15 + me.yAxis.zeroSite >= this.gride.translateY) { top = y - dom.offsetHeight - 20; }
    this.tooltipDom
      .style('opacity', '1')
      .style('top', top + 'px')
      .style('left', left + 'px');
  }
};

const lineChart = new LineChart(document.querySelector('.linechart'));
const options = {
  gride: {
    top: 20,
    left: 30,
    right: 20,
    bottom: 40
  },
  xAxis: {
    axisLine: {
      show: true,
      width: 2,
      color: 'black'
    },
    axisTick: {
      show: true,
      length: 5,
      width: 2,
      color: 'black'
    },
    axisLabel: {
      fontSize: 14,
      color: 'black',
      unit: ''
    }
  },
  yAxis: {
    axisLine: {
      show: true,
      width: 2,
      color: 'black'
    },
    axisTick: {
      show: true,
      length: 5,
      width: 2,
      color: 'black'
    },
    axisLabel: {
      fontSize: 14,
      color: 'black',
      unit: ''
    }
  },
  shape: {
    lineStyle: {
      color: 'black',
      width: 2
    },
    dotStyle: {
      show: true,
      size: 3.5,
      fillColor: 'black',
      borderColor: 'black',
      borderWidth: 1
    }
  },
  data: [
    { name: '星期一', data: '13' },
    { name: '星期二', data: '5' },
    { name: '星期三', data: '3' },
    { name: '星期四', data: '7' },
    { name: '星期五', data: '5' },
    { name: '星期六', data: '2' },
    { name: '星期天', data: '4' },
  ]
};
lineChart.setOption(options);
