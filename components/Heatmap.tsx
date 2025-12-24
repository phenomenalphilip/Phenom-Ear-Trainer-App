
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OCTAVE_NOTES } from '../constants';

interface HeatmapProps {
  data: number[]; // 12 numbers
  theme: 'light' | 'dark';
}

const Heatmap: React.FC<HeatmapProps> = ({ data, theme }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 240;
    const height = 240;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.4;

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<number>()
      .value(() => 1)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<number>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 10)
      .padAngle(0.02);

    const colorScale = d3.scaleLinear<string>()
      .domain([0, 0.5, 1])
      .range(['#FF2D55', '#FFD700', '#00FFCC']);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(d.data))
      .attr('stroke', theme === 'dark' ? '#121212' : '#ffffff')
      .attr('stroke-width', 2);

    // Labels
    const labelArc = d3.arc<d3.PieArcDatum<number>>()
      .innerRadius(radius + 5)
      .outerRadius(radius + 5);

    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .style('fill', theme === 'dark' ? '#E0E0E0' : '#111827')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text((_, i) => OCTAVE_NOTES[i]);

  }, [data, theme]);

  return (
    <div className="flex flex-col items-center">
      <svg ref={svgRef} width="280" height="280"></svg>
      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mt-2 font-bold">Ear Capacity Map</div>
    </div>
  );
};

export default Heatmap;
