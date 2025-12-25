
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { INTERVAL_NAMES } from '../constants';

interface HeatmapProps {
  data: number[]; // 12 numbers (0.0 to 1.0)
  theme: 'light' | 'dark';
  className?: string;
}

const Heatmap: React.FC<HeatmapProps> = ({ data, theme, className }) => {
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

    // Color Logic: Green > 80%, Yellow 50-79%, Red < 50%
    const getColor = (accuracy: number) => {
        if (accuracy >= 0.8) return '#00FFCC'; // Green
        if (accuracy >= 0.5) return '#FFD700'; // Yellow
        return '#FF2D55'; // Red
    };

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => getColor(d.data))
      .attr('stroke', theme === 'dark' ? '#121212' : '#ffffff')
      .attr('stroke-width', 2);

    // Labels
    const labelArc = d3.arc<d3.PieArcDatum<number>>()
      .innerRadius(radius - 35)
      .outerRadius(radius - 35);

    // Interval Labels
    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .style('fill', '#121212') // Always dark on the colored wedges for contrast
      .style('font-size', '10px')
      .style('font-weight', '900')
      .style('font-family', 'Inter, sans-serif')
      .text((_, i) => INTERVAL_NAMES[i]);
      
    // Center Text
    g.append('text')
       .attr('text-anchor', 'middle')
       .attr('dy', '-0.2em')
       .style('fill', theme === 'dark' ? '#E0E0E0' : '#111827')
       .style('font-size', '10px')
       .style('font-weight', 'bold')
       .text('EAR');
       
    g.append('text')
       .attr('text-anchor', 'middle')
       .attr('dy', '1.0em')
       .style('fill', theme === 'dark' ? '#E0E0E0' : '#111827')
       .style('font-size', '10px')
       .style('font-weight', 'bold')
       .text('MAP');

  }, [data, theme]);

  return (
    <div className={`flex flex-col items-center w-full max-w-[280px] ${className || ''}`}>
      <svg ref={svgRef} viewBox="0 0 240 240" className="w-full h-auto drop-shadow-2xl"></svg>
    </div>
  );
};

export default Heatmap;
