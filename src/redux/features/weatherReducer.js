import { createSlice } from '@reduxjs/toolkit';
import { getWeather } from '../../api/yrNoApi';
import { constants } from './settingsReducer';

export const slice = createSlice({
    name: 'weather',
    initialState: {},
    reducers: {
        setWeather(state, action) {
            state.data = { ...state, ...action.payload }
        },
        setCards(state, action) {
            state.cards = getCards(state.data, action.payload)
        },
        changeTemperatureType(state, action) {
            state.cards = state.cards.map(card => {
                card.temperature = temperatureConverter(card, action.payload);
                card.degrees = action.payload;
                return card;
            });
        }
    }
});

export const { setWeather, setCards, changeTemperatureType } = slice.actions;

export const fetchWeather = () => {
    return async dispatch => {
        try {
            const weather = await getWeather();
            dispatch(setWeather(weather));
        } catch (error) {
            console.error(error);
        }
    };
}

export const selectWeatherData = state => state.weather.data;
export const selectCards = state => state.weather.cards;

export default slice.reducer;

export function fahrenheitToCelciusAndViceVers(temperature, currentDegrees) {
    if (currentDegrees === constants.FAHRENHEIT) {
        return Math.round((temperature * 9 / 5) + 32);
    } else {
        return Math.round((temperature - 32) * 5 / 9);
    }
}

/**
 * Prepare cards from weather data.
 * 
 * @param {*} weatherData 
 * @param {*} startFrom 
 */
function getCards(weatherData, startFrom = 0) {
    const cards = [];
    const referenceDate = new Date();

    for (let i = startFrom, today = new Date(referenceDate.setDate(referenceDate.getDate() + startFrom)); i < 5; i++) {
        if (i > 0) {
            today.setDate(today.getDate() + 1);
        }

        cards.push(summarize(today, weatherData))
    }

    return cards;
}

/**
 * Collapse timeseries and get average weather data for a day.
 * 
 * @param {*} referenceDate 
 * @param {*} weatherData 
 */
function summarize(referenceDate, weatherData) {
    const summarizedDay = weatherData.properties.timeseries.filter(item => {
        const itemDate = new Date(item.time);
        const equalDates = itemDate.getFullYear() === referenceDate.getFullYear() &&
            itemDate.getMonth() === referenceDate.getMonth() &&
            itemDate.getDate() === referenceDate.getDate();
        if (new Date().getDate() === itemDate.getDate()) {
            // Filter by day for the current day.
            return equalDates;
        } else {
            // Filter timeseries by day and day time. We need weather during the day.
            const dayTime = itemDate.getHours() > 10 && itemDate.getHours() < 23
            return equalDates && dayTime;
        }
    }).reduce((acc, curr, idx, src) => {
        const { data: { instant: { details: { air_temperature, air_pressure_at_sea_level } } } } = curr;

        if (idx === 0) {
            const middle = src[Math.floor(src.length / 2)];
            const { data } = middle;
            acc.weatherType = summary(data)['next_6_hours'];
            acc.date = curr.time;
        }

        acc.temperature = air_temperature + acc.temperature;
        acc.pressure = air_pressure_at_sea_level + acc.pressure;
        acc.counter = acc.counter + 1;
        acc.date = acc.date ? acc.date : referenceDate;

        return acc;
    }, { temperature: 0, pressure: 0, counter: 0, date: null, weatherType: null });

    return {
        temperature: Math.round(summarizedDay.temperature / summarizedDay.counter),
        pressure: convertPressure(Math.round(summarizedDay.pressure / summarizedDay.counter)),
        weatherType: summarizedDay.weatherType,
        date: summarizedDay.date,
        degrees: constants.CELCIUS
    };
}

/**
 * Convert celcisus to fahrenheit and vice versa.
 * 
 * @param {*} card 
 * @param {*} currentDegrees 
 */
function temperatureConverter(card, currentDegrees) {
    if (card.degrees === currentDegrees || !currentDegrees) {
        return card.temperature;
    }

    return fahrenheitToCelciusAndViceVers(card.temperature, currentDegrees);
}

/**
 * Convert hPa pressure to mmHg.
 * 
 * @param {*} pressure 
 */
function convertPressure(pressure) {
    return Math.round(pressure * 0.75);
}

/**
 * Sometimes you can get one of 'next hours', some times all of them.
 * This proxy tries to go through all parameters to find next_6 in the first and
 * then 12 and then 1.
 * 
 * If nothing was found just returns 'Hmm..' 
 * @param {*} data 
 */
function summary(data) {
    const NEXT_1_HOURS = 'next_1_hours';
    const NEXT_6_HOURS = 'next_6_hours';
    const NEXT_12_HOURS = 'next_12_hours';

    return new Proxy(data, {      
        get: (target, prop) => {
            if (prop === NEXT_6_HOURS && target[prop]) {
                return target[prop].summary['symbol_code'];
            } else if (prop === NEXT_6_HOURS && !target[prop]) {
                if (target[NEXT_12_HOURS]) {
                    return target[NEXT_12_HOURS].summary['symbol_code'];
                } else if (target[NEXT_1_HOURS]) {
                    return target[NEXT_1_HOURS].summary['symbol_code'];
                } else {
                    return 'Hmm..';
                }
            }
        }
    });
}