// Game data and configuration
const gameData = {
    scenarios: [
        {
            name: "Urban Neighborhood",
            type: "scale-free",
            description: "Low vaccine uptake area with super-spreaders. A few highly connected individuals can rapidly spread infection throughout the community.",
            transmission_rate: 0.3,
            initial_infected: 1,
            resources: { vaccines: 15, quarantines: 8, link_cuts: 5, tests: 10, traces: 5 }
        },
        {
            name: "School Reopening",
            type: "small-world",
            description: "Students and teachers in clustered groups. Tight classroom clusters with some mixing between groups during breaks and activities.",
            transmission_rate: 0.25,
            initial_infected: 2,
            resources: { vaccines: 20, quarantines: 10, link_cuts: 8, tests: 15, traces: 7 }
        },
        {
            name: "Music Festival",
            type: "random",
            description: "High-risk event with random mixing. People from different backgrounds mingling randomly with high transmission risk.",
            transmission_rate: 0.4,
            initial_infected: 3,
            resources: { vaccines: 12, quarantines: 6, link_cuts: 4, tests: 8, traces: 4 }
        },
        {
            name: "Care Facility",
            type: "small-world",
            description: "Vulnerable elderly population. Residents in units with staff moving between groups, creating interconnected clusters.",
            transmission_rate: 0.35,
            initial_infected: 1,
            resources: { vaccines: 25, quarantines: 12, link_cuts: 6, tests: 12, traces: 8 }
        },
        {
            name: "Global Travel",
            type: "scale-free",
            description: "International travel network. Major hub airports connecting to many destinations, with potential for rapid global spread.",
            transmission_rate: 0.28,
            initial_infected: 2,
            resources: { vaccines: 18, quarantines: 9, link_cuts: 7, tests: 12, traces: 6 }
        }
    ],
    nodeStates: {
        susceptible: { color: "#4A90E2", label: "Susceptible" },
        vaccinated: { color: "#7ED321", label: "Vaccinated" },
        exposed: { color: "#F5A623", label: "Exposed" },
        infected: { color: "#D0021B", label: "Infected" },
        quarantined: { color: "#9013FE", label: "Quarantined" },
        recovered: { color: "#8E8E93", label: "Recovered" }
    },
    tools: [
        { name: "Vaccinate", icon: "💉", description: "Prevents infection and transmission", key: "vaccines" },
        { name: "Quarantine", icon: "🚫", description: "Isolates a person from others", key: "quarantines" },
        { name: "Sever Link", icon: "🔗", description: "Breaks a connection between people", key: "link_cuts" },
        { name: "Rapid Test", icon: "🧪", description: "Reveals if person is infected", key: "tests" },
        { name: "Contact Trace", icon: "📞", description: "Shows all contacts of selected person", key: "traces" }
    ]
};

// Game state
let gameState = {
    currentScenario: null,
    nodes: [],
    links: [],
    resources: {},
    selectedTool: null,
    selectedNode: null,
    simulationRunning: false,
    simulationSpeed: 1,
    day: 0,
    actionLog: [],
    highlightedNodes: new Set(),
    highlightedLinks: new Set()
};

// D3 setup
let svg, width, height, simulation, nodeElements, linkElements;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    populateScenarios();
    setupD3();
    setupLegend();
    setupTools();
    
    // Show instructions modal on first load
    document.getElementById('instructions-modal').style.display = 'flex';
}

function setupEventListeners() {
    // Scenario selection
    document.getElementById('scenario-select').addEventListener('change', onScenarioChange);
    document.getElementById('new-game-btn').addEventListener('click', initializeGame);
    
    // Simulation controls
    document.getElementById('start-sim-btn').addEventListener('click', startSimulation);
    document.getElementById('pause-sim-btn').addEventListener('click', pauseSimulation);
    document.getElementById('reset-sim-btn').addEventListener('click', resetGame);
    document.getElementById('speed-slider').addEventListener('input', onSpeedChange);
    
    // Modal controls
    document.getElementById('close-instructions').addEventListener('click', () => {
        document.getElementById('instructions-modal').style.display = 'none';
    });
    document.getElementById('start-playing').addEventListener('click', () => {
        document.getElementById('instructions-modal').style.display = 'none';
    });
    document.getElementById('close-results').addEventListener('click', () => {
        document.getElementById('results-modal').style.display = 'none';
    });
    document.getElementById('replay-btn').addEventListener('click', () => {
        document.getElementById('results-modal').style.display = 'none';
        resetGame();
    });
    document.getElementById('new-scenario-btn').addEventListener('click', () => {
        document.getElementById('results-modal').style.display = 'none';
        document.getElementById('scenario-select').value = '';
        onScenarioChange();
    });
}

function populateScenarios() {
    const select = document.getElementById('scenario-select');
    gameData.scenarios.forEach(scenario => {
        const option = document.createElement('option');
        option.value = scenario.name;
        option.textContent = scenario.name;
        select.appendChild(option);
    });
}

function onScenarioChange() {
    const selectedName = document.getElementById('scenario-select').value;
    if (selectedName) {
        gameState.currentScenario = gameData.scenarios.find(s => s.name === selectedName);
        document.getElementById('new-game-btn').disabled = false;
        updateScenarioInfo();
    } else {
        gameState.currentScenario = null;
        document.getElementById('new-game-btn').disabled = true;
        clearScenarioInfo();
    }
}

function updateScenarioInfo() {
    const scenario = gameState.currentScenario;
    document.getElementById('scenario-title').textContent = scenario.name;
    document.getElementById('scenario-description').innerHTML = `
        <p><strong>Network Type:</strong> ${scenario.type}</p>
        <p><strong>Description:</strong> ${scenario.description}</p>
        <p><strong>Transmission Rate:</strong> ${(scenario.transmission_rate * 100).toFixed(0)}%</p>
        <p><strong>Initial Infected:</strong> ${scenario.initial_infected}</p>
    `;
}

function clearScenarioInfo() {
    document.getElementById('scenario-title').textContent = 'Select a scenario to begin';
    document.getElementById('scenario-description').innerHTML = '<p>Select a scenario to see details about the outbreak situation and network structure.</p>';
}

function setupD3() {
    const container = document.getElementById('network-svg-container');
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = Math.max(500, rect.height);
    
    svg = d3.select('#network-svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create simulation
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(50))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(20));
}

function setupLegend() {
    const legendContainer = document.getElementById('legend-items');
    Object.entries(gameData.nodeStates).forEach(([key, state]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color" style="background-color: ${state.color}"></div>
            <span>${state.label}</span>
        `;
        legendContainer.appendChild(item);
    });
}

function setupTools() {
    const toolsContainer = document.getElementById('tools-grid');
    gameData.tools.forEach(tool => {
        const toolElement = document.createElement('div');
        toolElement.className = 'tool-item';
        toolElement.dataset.tool = tool.key;
        toolElement.innerHTML = `
            <div class="tool-info">
                <span class="tool-icon">${tool.icon}</span>
                <div>
                    <div class="tool-name">${tool.name}</div>
                    <div style="font-size: 11px; color: var(--color-text-secondary);">${tool.description}</div>
                </div>
            </div>
            <span class="tool-count">0</span>
        `;
        toolElement.addEventListener('click', () => selectTool(tool.key));
        toolsContainer.appendChild(toolElement);
    });
}

function selectTool(toolKey) {
    // Clear previous selection
    document.querySelectorAll('.tool-item').forEach(item => {
        item.classList.remove('tool-selected');
    });
    
    // Select new tool
    if (gameState.selectedTool === toolKey) {
        gameState.selectedTool = null; // Deselect if clicking same tool
    } else {
        gameState.selectedTool = toolKey;
        document.querySelector(`[data-tool="${toolKey}"]`).classList.add('tool-selected');
    }
    
    clearHighlights();
    updateToolCursor();
}

function updateToolCursor() {
    const svgElement = document.getElementById('network-svg');
    if (gameState.selectedTool) {
        svgElement.style.cursor = 'crosshair';
    } else {
        svgElement.style.cursor = 'default';
    }
}

function initializeGame() {
    if (!gameState.currentScenario) return;
    
    // Reset game state
    gameState.nodes = [];
    gameState.links = [];
    gameState.resources = { ...gameState.currentScenario.resources };
    gameState.selectedTool = null;
    gameState.selectedNode = null;
    gameState.simulationRunning = false;
    gameState.day = 0;
    gameState.actionLog = [];
    gameState.highlightedNodes.clear();
    gameState.highlightedLinks.clear();
    
    // Generate network
    generateNetwork();
    
    // Update UI
    updateResourceCounters();
    updateGameStatus();
    updateSimulationControls();
    clearActionLog();
    addLogEntry('Game initialized. Use tools strategically before starting the simulation.', 'action');
    
    // Clear tool selection
    document.querySelectorAll('.tool-item').forEach(item => {
        item.classList.remove('tool-selected');
    });
    updateToolCursor();
}

function generateNetwork() {
    const scenario = gameState.currentScenario;
    const nodeCount = 50;
    
    // Create nodes
    gameState.nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: i,
        state: 'susceptible',
        daysSinceInfection: 0,
        quarantined: false,
        tested: false,
        x: Math.random() * width,
        y: Math.random() * height
    }));
    
    // Generate links based on network type
    gameState.links = [];
    
    switch (scenario.type) {
        case 'scale-free':
            generateScaleFreeNetwork();
            break;
        case 'small-world':
            generateSmallWorldNetwork();
            break;
        case 'random':
            generateRandomNetwork();
            break;
    }
    
    // Set initial infections
    const shuffledNodes = [...gameState.nodes].sort(() => Math.random() - 0.5);
    for (let i = 0; i < scenario.initial_infected; i++) {
        shuffledNodes[i].state = 'infected';
        shuffledNodes[i].daysSinceInfection = 0;
    }
    
    renderNetwork();
}

function generateScaleFreeNetwork() {
    // Preferential attachment model
    const m = 3; // Number of edges to add per new node
    
    // Start with a small complete graph
    for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
            gameState.links.push({ source: i, target: j, severed: false });
        }
    }
    
    // Add remaining nodes
    for (let i = m; i < gameState.nodes.length; i++) {
        const degrees = gameState.nodes.map(node => 
            gameState.links.filter(link => 
                link.source === node.id || link.target === node.id
            ).length
        );
        
        const totalDegree = degrees.reduce((sum, deg) => sum + deg, 0);
        const addedTargets = new Set();
        
        while (addedTargets.size < Math.min(m, i)) {
            for (let j = 0; j < i && addedTargets.size < m; j++) {
                if (!addedTargets.has(j)) {
                    const probability = degrees[j] / totalDegree;
                    if (Math.random() < probability) {
                        gameState.links.push({ source: i, target: j, severed: false });
                        addedTargets.add(j);
                    }
                }
            }
        }
    }
}

function generateSmallWorldNetwork() {
    // Watts-Strogatz model
    const k = 6; // Each node connected to k nearest neighbors
    const p = 0.3; // Rewiring probability
    
    const n = gameState.nodes.length;
    
    // Create ring lattice
    for (let i = 0; i < n; i++) {
        for (let j = 1; j <= k / 2; j++) {
            const target = (i + j) % n;
            gameState.links.push({ source: i, target: target, severed: false });
        }
    }
    
    // Rewire edges with probability p
    gameState.links = gameState.links.map(link => {
        if (Math.random() < p) {
            let newTarget;
            do {
                newTarget = Math.floor(Math.random() * n);
            } while (newTarget === link.source || 
                     gameState.links.some(l => 
                         (l.source === link.source && l.target === newTarget) ||
                         (l.source === newTarget && l.target === link.source)
                     ));
            return { ...link, target: newTarget };
        }
        return link;
    });
}

function generateRandomNetwork() {
    // Erdős–Rényi model
    const p = 0.12; // Edge probability
    
    for (let i = 0; i < gameState.nodes.length; i++) {
        for (let j = i + 1; j < gameState.nodes.length; j++) {
            if (Math.random() < p) {
                gameState.links.push({ source: i, target: j, severed: false });
            }
        }
    }
}

function renderNetwork() {
    // Clear existing elements
    svg.selectAll('*').remove();
    
    // Create link elements
    linkElements = svg.selectAll('.link')
        .data(gameState.links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .classed('severed', d => d.severed)
        .on('click', onLinkClick);
    
    // Create node elements
    nodeElements = svg.selectAll('.node')
        .data(gameState.nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', 8)
        .attr('fill', d => gameData.nodeStates[d.state].color)
        .attr('stroke', '#fff')
        .on('click', onNodeClick)
        .on('mouseover', onNodeHover)
        .on('mouseout', onNodeOut)
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded));
    
    // Start simulation
    simulation.nodes(gameState.nodes);
    simulation.force('link').links(gameState.links);
    simulation.alpha(1).restart();
    
    simulation.on('tick', () => {
        linkElements
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        nodeElements
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });
}

function onNodeClick(event, d) {
    event.stopPropagation();
    
    if (gameState.selectedTool) {
        useTool(gameState.selectedTool, d);
    } else {
        selectNode(d);
    }
}

function onLinkClick(event, d) {
    event.stopPropagation();
    
    if (gameState.selectedTool === 'link_cuts' && gameState.resources.link_cuts > 0) {
        severLink(d);
    }
}

function onNodeHover(event, d) {
    // Show tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .html(`
            <strong>Person ${d.id}</strong><br>
            Status: ${gameData.nodeStates[d.state].label}<br>
            ${d.quarantined ? 'Quarantined<br>' : ''}
            ${d.tested ? 'Tested<br>' : ''}
            ${d.state === 'infected' || d.state === 'exposed' ? `Days since infection: ${d.daysSinceInfection}` : ''}
        `);
}

function onNodeOut() {
    d3.selectAll('.tooltip').remove();
}

function selectNode(node) {
    // Clear previous selection
    nodeElements.classed('selected', false);
    
    gameState.selectedNode = node;
    
    // Highlight selected node
    nodeElements.filter(d => d.id === node.id).classed('selected', true);
    
    // Update node info panel
    updateSelectedNodeInfo(node);
}

function updateSelectedNodeInfo(node) {
    const panel = document.getElementById('selected-node-info');
    const details = document.getElementById('node-details');
    
    const connections = gameState.links.filter(link => 
        (link.source.id === node.id || link.target.id === node.id) && !link.severed
    ).length;
    
    details.innerHTML = `
        <p><strong>ID:</strong> ${node.id}</p>
        <p><strong>Status:</strong> ${gameData.nodeStates[node.state].label}</p>
        <p><strong>Connections:</strong> ${connections}</p>
        ${node.quarantined ? '<p><strong>Quarantined:</strong> Yes</p>' : ''}
        ${node.tested ? '<p><strong>Tested:</strong> Yes</p>' : ''}
        ${node.state === 'infected' || node.state === 'exposed' ? 
            `<p><strong>Days infected:</strong> ${node.daysSinceInfection}</p>` : ''}
    `;
    
    panel.style.display = 'block';
}

function useTool(toolKey, node) {
    if (gameState.resources[toolKey] <= 0) {
        addLogEntry(`No ${toolKey} remaining!`, 'error');
        return;
    }
    
    switch (toolKey) {
        case 'vaccines':
            vaccinate(node);
            break;
        case 'quarantines':
            quarantine(node);
            break;
        case 'tests':
            test(node);
            break;
        case 'traces':
            contactTrace(node);
            break;
    }
    
    gameState.resources[toolKey]--;
    updateResourceCounters();
    updateToolAvailability();
}

function vaccinate(node) {
    if (node.state === 'susceptible') {
        node.state = 'vaccinated';
        addLogEntry(`Person ${node.id} vaccinated`, 'action');
        updateNodeDisplay(node);
        updateGameStatus();
    } else {
        addLogEntry(`Cannot vaccinate Person ${node.id} - not susceptible`, 'error');
    }
}

function quarantine(node) {
    if (!node.quarantined) {
        node.quarantined = true;
        if (node.state === 'infected') {
            node.state = 'quarantined';
        }
        addLogEntry(`Person ${node.id} quarantined`, 'action');
        updateNodeDisplay(node);
        updateGameStatus();
    } else {
        addLogEntry(`Person ${node.id} already quarantined`, 'error');
    }
}

function test(node) {
    node.tested = true;
    const actualState = node.state === 'exposed' ? 'infected' : node.state;
    addLogEntry(`Person ${node.id} tested - Result: ${gameData.nodeStates[actualState].label}`, 'action');
    
    if (gameState.selectedNode && gameState.selectedNode.id === node.id) {
        updateSelectedNodeInfo(node);
    }
}

function contactTrace(node) {
    const connections = gameState.links.filter(link => 
        (link.source.id === node.id || link.target.id === node.id) && !link.severed
    );
    
    // Highlight connected nodes and links
    gameState.highlightedNodes.clear();
    gameState.highlightedLinks.clear();
    
    connections.forEach(link => {
        const connectedNodeId = link.source.id === node.id ? link.target.id : link.source.id;
        gameState.highlightedNodes.add(connectedNodeId);
        gameState.highlightedLinks.add(link);
    });
    
    updateHighlights();
    addLogEntry(`Contact traced Person ${node.id} - ${connections.length} contacts identified`, 'action');
    
    // Clear highlights after 3 seconds
    setTimeout(clearHighlights, 3000);
}

function severLink(link) {
    link.severed = true;
    gameState.resources.link_cuts--;
    updateResourceCounters();
    updateToolAvailability();
    
    linkElements.filter(d => d === link).classed('severed', true);
    
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    addLogEntry(`Severed connection between Person ${sourceId} and Person ${targetId}`, 'action');
}

function updateHighlights() {
    nodeElements.classed('highlighted', d => gameState.highlightedNodes.has(d.id));
    linkElements.classed('highlighted', d => gameState.highlightedLinks.has(d));
}

function clearHighlights() {
    gameState.highlightedNodes.clear();
    gameState.highlightedLinks.clear();
    updateHighlights();
}

function updateNodeDisplay(node) {
    nodeElements.filter(d => d.id === node.id)
        .attr('fill', gameData.nodeStates[node.state].color)
        .classed('infected', node.state === 'infected');
}

function updateResourceCounters() {
    gameData.tools.forEach(tool => {
        const counter = document.querySelector(`[data-tool="${tool.key}"] .tool-count`);
        if (counter) {
            counter.textContent = gameState.resources[tool.key];
        }
    });
}

function updateToolAvailability() {
    gameData.tools.forEach(tool => {
        const toolElement = document.querySelector(`[data-tool="${tool.key}"]`);
        if (gameState.resources[tool.key] <= 0) {
            toolElement.classList.add('tool-disabled');
        } else {
            toolElement.classList.remove('tool-disabled');
        }
    });
}

function updateGameStatus() {
    const counts = {
        susceptible: 0,
        vaccinated: 0,
        exposed: 0,
        infected: 0,
        quarantined: 0,
        recovered: 0
    };
    
    gameState.nodes.forEach(node => {
        if (node.quarantined && node.state !== 'quarantined') {
            counts.quarantined++;
        } else {
            counts[node.state]++;
        }
    });
    
    document.getElementById('susceptible-count').textContent = counts.susceptible;
    document.getElementById('infected-count').textContent = counts.infected + counts.exposed;
    document.getElementById('vaccinated-count').textContent = counts.vaccinated;
    document.getElementById('recovered-count').textContent = counts.recovered + counts.quarantined;
}

function updateSimulationControls() {
    const hasScenario = gameState.currentScenario !== null;
    const hasNodes = gameState.nodes.length > 0;
    
    document.getElementById('start-sim-btn').disabled = !hasNodes || gameState.simulationRunning;
    document.getElementById('pause-sim-btn').disabled = !gameState.simulationRunning;
    document.getElementById('reset-sim-btn').disabled = !hasNodes;
}

function onSpeedChange() {
    const slider = document.getElementById('speed-slider');
    gameState.simulationSpeed = parseFloat(slider.value);
    document.getElementById('speed-value').textContent = `${gameState.simulationSpeed}x`;
}

// Simulation functions
let simulationInterval;

function startSimulation() {
    gameState.simulationRunning = true;
    updateSimulationControls();
    addLogEntry('Outbreak simulation started', 'action');
    
    simulationInterval = setInterval(() => {
        simulateDay();
    }, 1000 / gameState.simulationSpeed);
}

function pauseSimulation() {
    gameState.simulationRunning = false;
    clearInterval(simulationInterval);
    updateSimulationControls();
    addLogEntry('Simulation paused', 'action');
}

function simulateDay() {
    gameState.day++;
    let newInfections = 0;
    let newRecoveries = 0;
    
    // Process each node
    gameState.nodes.forEach(node => {
        if (node.state === 'infected' || node.state === 'exposed') {
            node.daysSinceInfection++;
            
            // Transition exposed to infected after 2 days
            if (node.state === 'exposed' && node.daysSinceInfection >= 2) {
                node.state = 'infected';
                addLogEntry(`Person ${node.id} became infectious`, 'infection');
                updateNodeDisplay(node);
            }
            
            // Recovery after 7 days
            if (node.daysSinceInfection >= 7) {
                node.state = 'recovered';
                node.quarantined = false;
                newRecoveries++;
                addLogEntry(`Person ${node.id} recovered`, 'recovery');
                updateNodeDisplay(node);
            }
        }
    });
    
    // Spread infection
    const infectedNodes = gameState.nodes.filter(node => 
        node.state === 'infected' && !node.quarantined
    );
    
    infectedNodes.forEach(infectedNode => {
        const connections = gameState.links.filter(link => 
            !link.severed && (
                link.source.id === infectedNode.id || link.target.id === infectedNode.id
            )
        );
        
        connections.forEach(link => {
            const targetNodeId = link.source.id === infectedNode.id ? 
                link.target.id : link.source.id;
            const targetNode = gameState.nodes.find(n => n.id === targetNodeId);
            
            if (targetNode.state === 'susceptible' && !targetNode.quarantined) {
                if (Math.random() < gameState.currentScenario.transmission_rate) {
                    targetNode.state = 'exposed';
                    targetNode.daysSinceInfection = 0;
                    newInfections++;
                    addLogEntry(`Person ${targetNode.id} exposed by Person ${infectedNode.id}`, 'infection');
                    updateNodeDisplay(targetNode);
                    
                    // Animate the transmission
                    linkElements.filter(d => d === link)
                        .classed('spreading', true)
                        .transition()
                        .duration(500)
                        .on('end', function() {
                            d3.select(this).classed('spreading', false);
                        });
                }
            }
        });
    });
    
    updateGameStatus();
    
    // Check if simulation should end
    const activeInfections = gameState.nodes.filter(node => 
        node.state === 'infected' || node.state === 'exposed'
    ).length;
    
    if (activeInfections === 0) {
        endSimulation();
    }
}

function endSimulation() {
    gameState.simulationRunning = false;
    clearInterval(simulationInterval);
    updateSimulationControls();
    addLogEntry('Outbreak ended', 'action');
    
    // Show results
    setTimeout(() => {
        showResults();
    }, 1000);
}

function resetGame() {
    gameState.simulationRunning = false;
    clearInterval(simulationInterval);
    
    if (gameState.currentScenario) {
        initializeGame();
    }
}

function showResults() {
    const totalInfected = gameState.nodes.filter(node => 
        node.state === 'recovered' || node.state === 'infected' || node.state === 'exposed'
    ).length;
    
    const totalVaccinated = gameState.nodes.filter(node => 
        node.state === 'vaccinated'
    ).length;
    
    const resourcesUsed = Object.values(gameState.currentScenario.resources).reduce((sum, initial) => sum + initial, 0) -
                         Object.values(gameState.resources).reduce((sum, remaining) => sum + remaining, 0);
    
    const infectionRate = (totalInfected / gameState.nodes.length * 100).toFixed(1);
    const preventionRate = ((gameState.nodes.length - totalInfected) / gameState.nodes.length * 100).toFixed(1);
    
    // Calculate score (higher is better)
    const score = Math.max(0, Math.round(
        (preventionRate * 2) + 
        (totalVaccinated / gameState.nodes.length * 100) - 
        (resourcesUsed / Object.values(gameState.currentScenario.resources).reduce((sum, val) => sum + val, 0) * 50)
    ));
    
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = `
        <div class="results-grid">
            <div class="result-card">
                <span class="result-value">${totalInfected}</span>
                <div class="result-label">Total Infected</div>
            </div>
            <div class="result-card">
                <span class="result-value">${infectionRate}%</span>
                <div class="result-label">Infection Rate</div>
            </div>
            <div class="result-card">
                <span class="result-value">${totalVaccinated}</span>
                <div class="result-label">Vaccinated</div>
            </div>
            <div class="result-card">
                <span class="result-value">${score}</span>
                <div class="result-label">Public Health Score</div>
            </div>
        </div>
        
        <div class="score-breakdown">
            <h4>Score Breakdown:</h4>
            <div class="score-item">
                <span>Prevention Rate (${preventionRate}%):</span>
                <span>+${(preventionRate * 2).toFixed(0)} points</span>
            </div>
            <div class="score-item">
                <span>Vaccination Coverage:</span>
                <span>+${(totalVaccinated / gameState.nodes.length * 100).toFixed(0)} points</span>
            </div>
            <div class="score-item">
                <span>Resource Efficiency:</span>
                <span>-${(resourcesUsed / Object.values(gameState.currentScenario.resources).reduce((sum, val) => sum + val, 0) * 50).toFixed(0)} points</span>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <h4>Key Insights:</h4>
            <ul>
                <li>${totalInfected === 0 ? 'Perfect outbreak prevention!' : 
                     totalInfected < 5 ? 'Excellent containment strategy!' :
                     totalInfected < 15 ? 'Good prevention efforts.' :
                     'Consider earlier intervention.'}</li>
                <li>${totalVaccinated > 20 ? 'High vaccination coverage helped significantly.' :
                     totalVaccinated > 10 ? 'Moderate vaccination coverage.' :
                     'More vaccination could have helped.'}</li>
                <li>${resourcesUsed < Object.values(gameState.currentScenario.resources).reduce((sum, val) => sum + val, 0) * 0.7 ? 
                     'Efficient use of resources.' : 'High resource utilization.'}</li>
            </ul>
        </div>
    `;
    
    document.getElementById('results-modal').style.display = 'flex';
}

function addLogEntry(message, type = 'info') {
    const logContent = document.getElementById('action-log-content');
    
    // Remove placeholder text if it exists
    if (logContent.children.length === 1 && logContent.textContent.includes('Game actions will appear here')) {
        logContent.innerHTML = '';
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `Day ${gameState.day}: ${message}`;
    
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
    
    // Keep only last 20 entries
    while (logContent.children.length > 20) {
        logContent.removeChild(logContent.firstChild);
    }
}

function clearActionLog() {
    const logContent = document.getElementById('action-log-content');
    logContent.innerHTML = '<p>Game actions will appear here...</p>';
}

// Drag functions for D3
function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Handle window resize
window.addEventListener('resize', function() {
    const container = document.getElementById('network-svg-container');
    const rect = container.getBoundingClientRect();
    const newWidth = rect.width;
    const newHeight = Math.max(500, rect.height);
    
    if (Math.abs(newWidth - width) > 50 || Math.abs(newHeight - height) > 50) {
        width = newWidth;
        height = newHeight;
        
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }
});