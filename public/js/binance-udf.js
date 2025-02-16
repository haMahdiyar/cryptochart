class BinanceUDFProvider {
    constructor(datafeedUrl) {
        this.datafeedUrl = datafeedUrl;
    }

    async getAllSymbols() {
        try {
            const response = await fetch(`${this.datafeedUrl}/exchangeInfo`);
            const data = await response.json();
            
            return data.symbols
                .filter(symbol => symbol.status === 'TRADING')
                .map(symbol => ({
                    symbol: symbol.symbol,
                    full_name: symbol.symbol,
                    description: `${symbol.baseAsset}/${symbol.quoteAsset}`,
                    exchange: 'BINANCE',
                    type: 'crypto'
                }));
        } catch (error) {
            console.error('Error getting symbols:', error);
            return [];
        }
    }

    async getKlines(symbol, interval, from, to, limit = 1000) {
        try {
            const params = new URLSearchParams({
                symbol: symbol,
                interval: this.convertResolution(interval),
                startTime: from * 1000,
                endTime: to * 1000,
                limit: limit
            });

            const response = await fetch(`${this.datafeedUrl}/klines?${params}`);
            const data = await response.json();

            return {
                s: 'ok',
                t: data.map(bar => bar[0] / 1000),
                o: data.map(bar => parseFloat(bar[1])),
                h: data.map(bar => parseFloat(bar[2])),
                l: data.map(bar => parseFloat(bar[3])),
                c: data.map(bar => parseFloat(bar[4])),
                v: data.map(bar => parseFloat(bar[5]))
            };
        } catch (error) {
            console.error('Error getting klines:', error);
            return {
                s: 'error',
                errmsg: 'Failed to load data'
            };
        }
    }

    convertResolution(resolution) {
        const intervals = {
            '1': '1m',
            '3': '3m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1h',
            '120': '2h',
            '240': '4h',
            '360': '6h',
            '480': '8h',
            '720': '12h',
            'D': '1d',
            '1D': '1d',
            '3D': '3d',
            'W': '1w',
            '1W': '1w',
            'M': '1M',
            '1M': '1M'
        };
        return intervals[resolution] || '1d';
    }

    async getLastPrice(symbol) {
        try {
            const response = await fetch(`${this.datafeedUrl}/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            return parseFloat(data.price);
        } catch (error) {
            console.error('Error getting last price:', error);
            return null;
        }
    }
}