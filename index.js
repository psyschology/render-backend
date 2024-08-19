const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let gameState = {
    started: false,
    numbersCalled: [],
    tickets: [],
    nextGameTime: null,
    ticketLimit: 0,
};

// Broadcast function to send updates to all connected clients
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Handle WebSocket connections
wss.on('connection', ws => {
    // Send the current game state to the new client
    ws.send(JSON.stringify({ type: 'INIT', gameState }));

    ws.on('message', message => {
        const { type, payload } = JSON.parse(message);

        if (type === 'START_GAME') {
            gameState.started = true;
            gameState.numbersCalled = [];
            broadcast({ type: 'GAME_STARTED', gameState });

            // Start calling numbers (simulated with an interval)
            const intervalId = setInterval(() => {
                if (!gameState.started || gameState.numbersCalled.length >= 90) {
                    clearInterval(intervalId);
                    return;
                }

                const number = Math.floor(Math.random() * 90) + 1;
                if (!gameState.numbersCalled.includes(number)) {
                    gameState.numbersCalled.push(number);
                    broadcast({ type: 'NUMBER_CALLED', number });
                }
            }, 2000);

        } else if (type === 'STOP_GAME') {
            gameState.started = false;
            broadcast({ type: 'GAME_STOPPED' });

        } else if (type === 'SET_GAME_TIME') {
            gameState.nextGameTime = payload;
            broadcast({ type: 'GAME_TIME_SET', gameState });

        } else if (type === 'SET_TICKET_LIMIT') {
            gameState.ticketLimit = payload.limit;
            gameState.tickets = Array.from({ length: payload.limit }, (_, i) => ({
                id: i + 1,
                owner: null,
                numbers: generateTicketNumbers(),
            }));
            broadcast({ type: 'TICKETS_UPDATED', tickets: gameState.tickets });

        } else if (type === 'BOOK_TICKET') {
            const ticket = gameState.tickets.find(t => t.id === payload.id);
            if (ticket) {
                ticket.owner = payload.owner;
                broadcast({ type: 'TICKET_BOOKED', ticket });
            }
        }
    });
});

function generateTicketNumbers() {
    const ticket = Array(3)
        .fill(null)
        .map(() => Array(9).fill(null));

    for (let i = 0; i < 3; i++) {
        const row = ticket[i];
        const columns = Array.from({ length: 9 }, (_, j) => j).sort(() => 0.5 - Math.random()).slice(0, 5);

        columns.forEach(column => {
            const start = column * 10 + 1;
            const end = column === 8 ? 90 : start + 9;
            const num = Math.floor(Math.random() * (end - start + 1)) + start;
            row[column] = num;
        });
    }

    return ticket;
}

server.listen(process.env.PORT || 4000, () => {
    console.log(`Server is listening on port ${server.address().port}`);
});
