import React from 'react';
import WeatherCard from './WeatherCard/WeatherCard';
import Arrows from './Controls/Arrows/Arrows';
import Degrees from './Controls/Degrees/Degrees';
import Chart from './Chart/Chart';

export default function () {
    return <>
        <Degrees />
        <Arrows />
        <WeatherCard />
        <Chart />
    </>
}