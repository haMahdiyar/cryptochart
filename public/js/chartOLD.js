
let tvWidget = null;
let chartMarks = [];
let deletedMarks = new Set();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function showModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

async function saveVersion() {
  const title = document.getElementById('versionTitle').value.trim();
  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    const saveButton = document.getElementById('saveBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    tvWidget.save(async (state) => {
      try {
        const response = await fetch('/api/save-chart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            chartState: state
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save chart');
        }

        const result = await response.json();
        if (result.success) {
          alert('Saved successfully!');
          closeModal('saveModal');
          document.getElementById('versionTitle').value = '';
        } else {
          throw new Error(result.error || 'Failed to save chart');
        }
      } catch (error) {
        console.error('Error saving:', error);
        alert(error.message || 'Failed to save! Please try again.');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Chart';
      }
    });
  } catch (error) {
    console.error('Error in save process:', error);
    alert('Failed to prepare chart for saving! Please try again.');
    const saveButton = document.getElementById('saveBtn');
    saveButton.disabled = false;
    saveButton.textContent = 'Save Chart';
  }
}

async function loadVersion(versionId) {
  try {
    const response = await fetch(`/api/charts/${versionId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load chart');
    }

    const result = await response.json();
    if (result.success) {
      tvWidget.load(result.chart);
      closeModal('loadModal');
    } else {
      throw new Error(result.error || 'Failed to load chart');
    }
  } catch (error) {
    console.error('Error loading chart:', error);
    alert(error.message || 'Failed to load chart! Please try again.');
  }
}

async function loadVersionsList() {
  try {
    const loadButton = document.getElementById('loadBtn');
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';

    const response = await fetch('/api/charts');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load versions list');
    }

    const result = await response.json();
    if (result.success) {
      const versionsContainer = document.getElementById('versionsList');
      versionsContainer.innerHTML = '';
      
      const charts = Object.entries(result.charts);
      if (charts.length === 0) {
        versionsContainer.innerHTML = '<div class="version-item">No saved charts found</div>';
      } else {
        charts.forEach(([id, data]) => {
          const versionElement = document.createElement('div');
          versionElement.className = 'version-item';
          versionElement.onclick = () => loadVersion(id);
          
          const date = new Date(data.savedAt);
          versionElement.innerHTML = `
            <strong>${data.title}</strong><br>
            <small>${date.toLocaleString()}</small>
          `;
          
          versionsContainer.appendChild(versionElement);
        });
      }
      
      showModal('loadModal');
    } else {
      throw new Error(result.error || 'Failed to load versions list');
    }
  } catch (error) {
    console.error('Error loading versions list:', error);
    alert(error.message || 'Failed to load versions list! Please try again.');
  } finally {
    const loadButton = document.getElementById('loadBtn');
    loadButton.disabled = false;
    loadButton.textContent = 'Load Chart';
  }
}

window.addEventListener('DOMContentLoaded', function() {

  const binanceProvider = new BinanceUDFProvider('https://api.binance.com/api/v3');

  const customDatafeed = {
        onReady: callback => {
            setTimeout(() => {
                callback({
                    supported_resolutions: ["1", "3", "5", "15", "30", "60", "120", "240", "360", "480", "720", "1D", "3D", "1W", "1M"],
                    exchanges: [{value: "BINANCE", name: "Binance", desc: "Binance Exchange"}],
                    symbols_types: [{name: "crypto", value: "crypto"}]
                });
            }, 0);
        },
        searchSymbols: async (userInput, exchange, symbolType, onResult) => {
            try {
                const symbols = await binanceProvider.getAllSymbols();
                const matchingSymbols = symbols.filter(symbol => 
                    symbol.symbol.toLowerCase().includes(userInput.toLowerCase())
                );
                onResult(matchingSymbols);
            } catch (error) {
                console.error('Error searching symbols:', error);
                onResult([]);
            }
        },
        resolveSymbol: async (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
            try {
                const symbols = await binanceProvider.getAllSymbols();
                const symbolItem = symbols.find(symbol => symbol.symbol === symbolName);
                
                if (!symbolItem) {
                    onResolveErrorCallback('Symbol not found');
                    return;
                }

                const symbolInfo = {
                    name: symbolItem.symbol,
                    full_name: symbolItem.symbol,
                    description: symbolItem.description,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: 'BINANCE',
                    minmov: 1,
                    pricescale: 100000000,
                    has_intraday: true,
                    has_daily: true,
                    has_weekly_and_monthly: true,
                    supported_resolutions: ["1", "3", "5", "15", "30", "60", "120", "240", "360", "480", "720", "1D", "3D", "1W", "1M"],
                    volume_precision: 8,
                    data_status: 'streaming',
                };

                onSymbolResolvedCallback(symbolInfo);
            } catch (error) {
                console.error('Symbol resolution error:', error);
                onResolveErrorCallback('Symbol resolution error: ' + error.message);
            }
        },
        getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
            try {
                const bars = await binanceProvider.getKlines(
                    symbolInfo.name,
                    resolution,
                    periodParams.from,
                    periodParams.to
                );
                
                if (bars.s !== 'ok') {
                    onErrorCallback(bars.errmsg);
                    return;
                }

                onHistoryCallback(bars.t.map((time, index) => ({
                    time: time * 1000,
                    open: parseFloat(bars.o[index]),
                    high: parseFloat(bars.h[index]),
                    low: parseFloat(bars.l[index]),
                    close: parseFloat(bars.c[index]),
                    volume: parseFloat(bars.v[index])
                })), { noData: bars.t.length === 0 });
            } catch (error) {
                console.error('Error getting bars:', error);
                onErrorCallback('Network error: ' + error.message);
            }
        },
        subscribeBars: () => {
            // برای real-time updates
        },
        unsubscribeBars: () => {
            // برای لغو real-time updates
        }
    };

  // Create a shared shape configuration
  const createShapeConfig = (symbol, timestamp) => ({
    shape: "arrow_down",  // Changed from xcross to cross
    lock: false,
    disableSelection: false,
    overrides: {
        color: "#FF0000",
        linewidth: 2,
        size: 2,
        backgroundColor: "transparent",
        transparency: 10,
        visible: true,
        zLevel: "top",
        fixedSize: true,
        markType: "arrow_down",  // Added explicit mark type
        borderColor: "#FF0000",  // Added border color
        clickHandler: () => {
            if (confirm('Do you want to remove this mark?')) {
                removeMark(symbol, timestamp);
            }
        }
    }
  });

  tvWidget = new TradingView.widget({
    container: 'chartContainer',
    library_path: 'charting_library/',
    clientId: 'tradingview.com',
    userId: 'public_user_id',
    fullscreen: true,
    autosize: true,
    symbol: 'TONUSDT',
    interval: '1D',
    timezone: 'Etc/UTC',
    theme: 'Dark',
    style: '1',
    locale: 'en',
    datafeed: customDatafeed,
    enabled_features: [
        "create_volume_indicator_by_default",
        "use_localstorage_for_settings",
        "draw_on_chart_markers",
        "show_object_tree",
        "study_templates"
    ],
    drawings_access: {
        type: 'all',
        tools: [
          { name: "Regression Trend" },
          { name: "Trend Line" },
          { name: "Text" },
          { name: "Ray" },
          { name: "Arrow" },
          { name: "Arrow Mark Down" },
          { name: "Arrow Mark Up" },
          { name: "Arrow Mark Left" },
          { name: "Arrow Mark Right" },
          { name: "Flag" },
          { name: "Vertical Line" },
          { name: "Horizontal Line" },
          { name: "Cross Line" },
          { name: "Rectangle" },
          { name: "Circle" },
          { name: "Triangle" },
          { name: "Remove" }
      ]
    },
    time_frames: [
        { text: "1D", resolution: "1D" },
        { text: "5D", resolution: "1D" },
        { text: "1M", resolution: "1D" },
        { text: "3M", resolution: "1D" },
        { text: "6M", resolution: "1D" },
        { text: "1Y", resolution: "1D" }
    ],
  });


async function loadMarks(symbol) {
    console.log('Loading marks for symbol:', symbol);
    try {
        // Ensure chart is ready
        await wait(500); // Increased wait time
        
        const response = await fetch(`/api/marks/${symbol}`);
        if (!response.ok) {
            throw new Error('Failed to load marks');
        }

        const data = await response.json();
        console.log('Received marks from server:', data);
        const chart = tvWidget.activeChart();

        // Clear existing marks
        for (const mark of chartMarks) {
            try {
                chart.removeEntity(mark.id);
            } catch (e) {
                console.warn('Failed to remove mark:', e);
            }
        }
        chartMarks = [];
        deletedMarks.clear();

        // Add new marks
        if (data.marks && Array.isArray(data.marks)) {
            for (const mark of data.marks) {
                try {
                    const timestamp = parseInt(mark.timestamp);
                    console.log('Creating mark with timestamp:', timestamp);
                    
                    const markId = chart.createShape(
                        { 
                            time: timestamp / 1000,
                            channel: "high",
                            offset: 50
                        },
                        {
                            shape: "arrow_down",
                            lock: true,
                            disableSelection: true,
                            overrides: {
                                color: "#FF0000",
                                linewidth: 2,
                                size: 2,
                                backgroundColor: "transparent",
                                transparency: 10,
                                visible: true,
                                zLevel: "top",
                                fixedSize: true,
                                clickHandler: () => {
                                    if (confirm('Do you want to remove this mark?')) {
                                        removeMark(symbol, timestamp);
                                    }
                                }
                            }
                        }
                    );

                    chartMarks.push({
                        id: markId,
                        timestamp: timestamp
                    });
                    
                    console.log('Mark created successfully:', { id: markId, timestamp });
                } catch (e) {
                    console.error('Failed to create mark:', e, mark);
                }
            }
        }
        
        console.log('Final marks count:', chartMarks.length);
    } catch (error) {
        console.error('Error loading marks:', error);
    }
}

// Update markDate function to ensure proper data format
async function markDate() {
    const dateInput = document.getElementById('markDate');
    const selectedDate = new Date(dateInput.value);
    
    if (!dateInput.value || isNaN(selectedDate.getTime())) {
        alert('Please select a valid date');
        return;
    }

    selectedDate.setUTCHours(0, 0, 0, 0);
    const timestamp = selectedDate.getTime();
    const symbol = tvWidget.activeChart().symbol();
    const chart = tvWidget.activeChart();

    try {
        console.log('Creating mark for:', new Date(timestamp).toISOString());

        // First save to database with proper data structure
        const response = await fetch('/api/mark-date', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                symbol,
                timestamp,
                date: dateInput.value
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save mark');
        }

        // Create the mark on the chart
        const markId = chart.createShape(
            { 
                time: timestamp / 1000,
                channel: "high",
                offset: 200
            },
            createShapeConfig(symbol, timestamp)
        );

        // Store mark data locally
        chartMarks.push({
            id: markId,
            timestamp: timestamp
        });

        console.log('Mark saved successfully');
    } catch (error) {
        console.error('Error marking date:', error);
        alert(error.message);
    }
}

// Add the clearAllMarks function
async function clearAllMarks() {
  if (!confirm('Are you sure you want to delete all marks? This cannot be undone.')) {
      return;
  }

  const symbol = tvWidget.activeChart().symbol();
  const chart = tvWidget.activeChart();

  try {
      const response = await fetch('/api/marks/clear-all', {
          method: 'DELETE',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol })
      });

      if (!response.ok) {
          throw new Error('Failed to clear marks');
      }

      // Remove all marks from chart
      chartMarks.forEach(mark => {
          try {
              chart.removeEntity(mark.id);
          } catch (e) {
              console.warn('Failed to remove mark:', e);
          }
      });

      // Clear local arrays
      chartMarks = [];
      deletedMarks.clear();

      console.log('All marks cleared successfully');
      alert('All marks have been cleared');
  } catch (error) {
      console.error('Error clearing marks:', error);
      alert('Failed to clear marks: ' + error.message);
  }
}

// Update the removeMark function
async function removeMark(symbol, timestamp) {
  try {
      console.log('Removing mark:', { symbol, timestamp });
      
      const response = await fetch(`/api/marks/${symbol}/${timestamp}`, {
          method: 'DELETE',
          headers: {
              'Content-Type': 'application/json',
          }
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete mark');
      }

      // Remove from chart and local storage
      const markToRemove = chartMarks.find(mark => mark.timestamp === timestamp);
      if (markToRemove) {
          console.log('Found mark to remove:', markToRemove);
          const chart = tvWidget.activeChart();
          chart.removeEntity(markToRemove.id);
          
          // Update local arrays
          chartMarks = chartMarks.filter(mark => mark.timestamp !== timestamp);
          deletedMarks.add(timestamp.toString());
          
          console.log('Updated chartMarks:', chartMarks);
          console.log('Updated deletedMarks:', Array.from(deletedMarks));
      }

      console.log('Mark removed successfully');
  } catch (error) {
      console.error('Error removing mark:', error);
      alert('Failed to remove mark: ' + error.message);
  }
}

tvWidget.onChartReady(() => {
  console.log('Chart is ready');
  const chart = tvWidget.activeChart();

//   chart.getAllStudies().forEach(study => {
//       console.log('Removing study:', study);
//       chart.removeEntity(study.id);
//   });

  // Initial load
    setTimeout(async () => {
        await loadMarks(chart.symbol());
    }, 500);

    // Symbol change handler
    chart.onSymbolChanged().subscribe(null, async () => {
        const newSymbol = chart.symbol();
        console.log('Symbol changed to:', newSymbol);
        
        // Clear existing marks
        const currentChart = tvWidget.activeChart();
        for (const mark of chartMarks) {
            try {
                currentChart.removeEntity(mark.id);
            } catch (e) {
                console.warn('Failed to remove mark:', e);
            }
        }
        chartMarks = [];
        deletedMarks.clear();
        
        // Load new marks after chart is ready
        await wait(500);
        await loadMarks(newSymbol);
    });

});

  // Add event listener for the mark button
  document.getElementById('markBtn').addEventListener('click', markDate);

  // Add clear marks button event listener
  document.getElementById('clearMarksBtn').addEventListener('click', clearAllMarks);

  document.getElementById('saveBtn').addEventListener('click', () => showModal('saveModal'));
  document.getElementById('loadBtn').addEventListener('click', () => {
    showModal('loadModal');
    loadVersionsList();
  });



  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target.id);
    }
  });
});
