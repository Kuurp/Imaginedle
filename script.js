const CORRECT = 'correct';
const PARTIALLY_CORRECT = 'partially_correct';
const WRONG = 'wrong';

const LOWER = 'lower';
const MUCH_LOWER = 'much_lower';
const HIGHER = 'higher';
const MUCH_HIGHER = 'much_higher';

const MUCH_THRESHOLD = 5;

const csvPath = 'data.csv';
const urlForResultShare = 'https://kuuro-neko.github.io/Imaginedle/';
const fieldLength = 5;
const triesToHint = 5;

var game = {
    tries: [],
    hintShown: false,
};
var playerData = JSON.parse(localStorage.getItem('imaginedlePlayerData') || '{}');
var stats = JSON.parse(localStorage.getItem('imaginedleStats') || '{}');

function getSeed(date = new Date()) {
    const now = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

const todaysSeed = getSeed();
setInterval(() => {
    if (getSeed() !== todaysSeed) {
        location.reload();
    }
}, 10000);

function processDataAsText(text) {
    return text
        .trim()
        .split('\n')
        .slice(2)  // Skip first two rows (title and header)
        .filter(row => row.trim())
        .filter(row => {
            const fields = row.split(',');
            return fields.length === fieldLength && fields.every(field => field.trim());
        })
        .map(row => {
            const [name, sex, ues, firstPub, team] = row.split(',').map(field => field.trim());
            return { name, sex, ues, firstPub, team };
        });
}

async function getData(csvPath) {
    const response = await fetch(csvPath);
    const text = await response.text();
    return processDataAsText(text);
}

let data;
let todaysCharIndex;
let suggestionHighlight = -1;

const input = document.querySelector('input');
const suggestionsDiv = document.getElementById('suggestions');
const rowsDiv = document.getElementById('rows');
const hintBtn = document.getElementById('hintBtn');

getData(csvPath).then(loadedData => {
    data = loadedData;
    todaysCharIndex = getSeed() % data.length;
    
    const seed = getSeed();
    loadGameData(seed, playerData);
    displayGame();
});

hintBtn.addEventListener('click', () => {
    if (game.tries.length >= triesToHint && !game.hintShown) {
        const todaysChar = data[todaysCharIndex];
        game.hintShown = true;
        const seed = getSeed();
        const won = game.tries.includes(todaysChar.name);
        playerData[seed] = { 
            tries: game.tries, 
            hintShown: game.hintShown,
            win: won,
            stored: false
        };
        localStorage.setItem('imaginedlePlayerData', JSON.stringify(playerData));
        
        hintBtn.outerHTML = `<div id="hintDisplay" style="background-color: ${todaysChar.hint}; display: inline-flex; align-items: center; justify-content: center; margin-left: 10px; border: 2px solid #000;">Hint</div>`;
    }
});

input.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase();
    suggestionsDiv.innerHTML = '';
    suggestionHighlight = -1;
    
    if (value) {
        const matches = data.filter(char => {
            const words = char.name.toLowerCase().split(' ');
            return words.some(word => word.startsWith(value)) && !game.tries.includes(char.name);
        });
        
        if (matches.length === 0) {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = 'No character found';
            item.style.cursor = 'default';
            item.classList.add('no-match');
            suggestionsDiv.appendChild(item);
        } else {
            matches.forEach((char, index) => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = char.name;
                item.addEventListener('click', () => {
                    play(char.name);
                });
                suggestionsDiv.appendChild(item);
            });
        }
    }
});

function updateSuggestionHighlight() {
    const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');
    suggestions.forEach((item, index) => {
        if (index === suggestionHighlight) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

input.addEventListener('keydown', (e) => {
    const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');
    
    if (suggestions.length === 0) {
        if (e.key === 'Enter') {
            return;
        }
    }
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestions.length > 0) {
            suggestionHighlight = (suggestionHighlight + 1) % suggestions.length;
            updateSuggestionHighlight();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestions.length > 0) {
            suggestionHighlight = suggestionHighlight <= 0 ? suggestions.length - 1 : suggestionHighlight - 1;
            updateSuggestionHighlight();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions.length > 0) {
            const indexToValidate = suggestionHighlight === -1 ? 0 : suggestionHighlight;
            const charName = suggestions[indexToValidate].textContent;
            play(charName);
        }
    }
});

function play(charName) {
    const charIndex = data.findIndex(char => char.name === charName);
    if (charIndex === -1) return;
    
    const char = data[charIndex];
    const todaysChar = data[todaysCharIndex];
    
    game.tries.push(charName);
    const seed = getSeed();
    const won = charName === todaysChar.name;
    
    // If won, immediately store in stats
    if (won) {
        const numTries = game.tries.length;
        stats[numTries] = (stats[numTries] || 0) + 1;
        localStorage.setItem('imaginedleStats', JSON.stringify(stats));
        sendStats(JSON.stringify(game.tries), numTries);
    }
    
    playerData[seed] = { 
        tries: game.tries, 
        hintShown: game.hintShown,
        win: won,
        stored: won  // Mark as stored if won
    };
    localStorage.setItem('imaginedlePlayerData', JSON.stringify(playerData));
    
    displayGame();
    
    input.value = '';
    suggestionsDiv.innerHTML = '';
    suggestionHighlight = -1;
}

function cleanupOldGames(currentSeed, playerData) {
    const seedsToRemove = [];
    let statsUpdated = false;
    
    for (const seed in playerData) {
        if (seed !== currentSeed.toString()) {
            const gameData = playerData[seed];
            
            const hasWin = gameData.win === true;
            const hasStored = gameData.stored === true;
            const isOldFormat = !('win' in gameData) && !('stored' in gameData);

            if ((hasWin && !hasStored) || isOldFormat) {
                if (hasWin || (isOldFormat && gameData.tries)) {
                    const tries = gameData.tries || [];
                    const todaysCharForOldGame = data[parseInt(seed) % data.length];
                    const won = tries.includes(todaysCharForOldGame.name);
                    
                    if (won) {
                        const numTries = tries.length;
                        stats[numTries] = (stats[numTries] || 0) + 1;
                        statsUpdated = true;
                    }
                }
            }
            
            seedsToRemove.push(seed);
        }
    }
    
    seedsToRemove.forEach(seed => delete playerData[seed]);
    
    if (seedsToRemove.length > 0) {
        localStorage.setItem('imaginedlePlayerData', JSON.stringify(playerData));
    }
    
    if (statsUpdated) {
        localStorage.setItem('imaginedleStats', JSON.stringify(stats));
    }
}

function loadGameData(seed, playerData) {
    cleanupOldGames(seed, playerData);
    
    if (playerData[seed]) {
        game.tries = playerData[seed].tries || [];
        game.hintShown = playerData[seed].hintShown || false;
    } else {
        game.tries = [];
        game.hintShown = false;
    }
}

const emojiMap = {
    'correct': '🟩',
    'partially_correct': '🟨',
    'wrong': '🟥',
    'lower': '🟨',
    'much_lower': '🟥',
    'higher': '🟨',
    'much_higher': '🟥',
    undefined: '🟥',
    'undefined': '🟥'
};

function includes(str1, str2) {
    return str1.indexOf(str2) !== -1;
}

function compare(played, todays) {
    return played === todays ? CORRECT : WRONG;
}

function compareUEs(played, todays) {
    // UES are list of string separated by ;
    const playedUEs = played.split(';').map(ue => ue.trim().toLowerCase()).filter(Boolean);
    const todaysUEs = todays.split(';').map(ue => ue.trim().toLowerCase()).filter(Boolean);
    
    const hasExactMatch =
        playedUEs.length === todaysUEs.length &&
        playedUEs.every(ue => todaysUEs.includes(ue));
    if (hasExactMatch) {
        return CORRECT;
    }
    
    const hasPartialMatch = playedUEs.some(playedUE =>
        todaysUEs.some(todaysUE => includes(todaysUE, playedUE))
    );
    if (hasPartialMatch) {
        return PARTIALLY_CORRECT;
    }
    
    return WRONG;
}

function displayUEList(ues) {
    return ues.split(';').map(ue => ue.trim()).filter(Boolean).join('<br>');
}

function compareFirstPubYear(played, todays) {
    const playedNum = parseInt(played);
    const todaysNum = parseInt(todays);
    
    if (playedNum === todaysNum) {
        return CORRECT;
    }
    if (played === "N/A") {
        if (todays === "N/A") {
            return CORRECT;
        } else {
            return WRONG;
        }
    }
    if (playedNum < todaysNum) {
        if (todaysNum - playedNum >= MUCH_THRESHOLD) {
            return MUCH_LOWER;
        }
        return LOWER;
    }
    if (playedNum > todaysNum) {
        if (playedNum - todaysNum >= MUCH_THRESHOLD) {
            return MUCH_HIGHER;
        }
        return HIGHER;
    }
}

function compareChar(charPlayed, todaysChar) {
    return {
        name: compare(charPlayed.name, todaysChar.name),
        sex: compare(charPlayed.sex, todaysChar.sex),
        ues: compareUEs(charPlayed.ues, todaysChar.ues),
        firstPub: compareFirstPubYear(charPlayed.firstPub, todaysChar.firstPub),
        team: compare(charPlayed.team, todaysChar.team),
    };
}

function charRecapEmoji(comparison) {
    var recap = '';
    recap += emojiMap[comparison.name];
    recap += emojiMap[comparison.sex];
    recap += emojiMap[comparison.ues];
    recap += emojiMap[comparison.firstPub];
    recap += emojiMap[comparison.team];
    return recap;
}

function resultToClipboard() {
    const todaysChar = data[todaysCharIndex];
    let result = `Imaginedle - ${game.tries.length} essais\n`;
    game.tries.forEach(charName => {
        const charIndex = data.findIndex(char => char.name === charName);
        if (charIndex === -1) return;
        
        const char = data[charIndex];
        const comparison = compareChar(char, todaysChar);
        result += `${charRecapEmoji(comparison)}\n`;
    });
    result += `${urlForResultShare}`;
    const copiedDiv = document.getElementById('copied');
    navigator.clipboard.writeText(result).then(() => {
        copiedDiv.style.display = '';
        setTimeout(() => {
            copiedDiv.style.display = 'none';
        }, 2000);
    });
}

function getWinDivInnerHTML() {
    const todaysChar = data[todaysCharIndex];
    return `
        <h2>Victoire!</h2>
        <p>Tu as deviné ${todaysChar.name} correctement en ${game.tries.length} essai${game.tries.length > 1 ? 's' : ''}!</p>
        <div id="share">
            <button id="shareBtn" onclick="resultToClipboard()">Partager</button>
        </div>
        <div id="copied" style="display:none;">Résultat copié dans le presse-papier!</div>`;
}

function displayGame() {
    rowsDiv.innerHTML = '';
    if (game.tries.length > 0) {
        document.getElementById('header').style.display = '';
    }
    const todaysChar = data[todaysCharIndex];
    game.tries.forEach(charName => {
        const charIndex = data.findIndex(char => char.name === charName);
        if (charIndex === -1) return;
        
        const char = data[charIndex];

        const comparison = compareChar(char, todaysChar);
        
        const nameClass = comparison.name;
        const sexClass = comparison.sex;
        const uesClass = comparison.ues;
        const firstPubClass = comparison.firstPub;
        const teamClass = comparison.team;
        
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `
            <div class="name ${nameClass}">${char.name}</div>
            <div class="sex ${sexClass}">${char.sex}</div>
            <div class="ues ${uesClass}">${displayUEList(char.ues)}</div>
            <div class="firstPub ${firstPubClass}">${char.firstPub}</div>
            <div class="team ${teamClass}">${char.team}</div>
        `;
        rowsDiv.appendChild(row);
    });

    const hintElement = document.getElementById('hintBtn');
    if (hintElement) {
        if (game.tries.length >= triesToHint) {
            hintElement.textContent = `Hint`;
            hintElement.disabled = false;
        } else {
            hintElement.textContent = `Hint (${game.tries.length}/${triesToHint})`;
            hintElement.disabled = true;
        }
    }
    
    if (game.hintShown) {
        const todaysChar = data[todaysCharIndex];
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            hintBtn.outerHTML = `
                <div id="hintDisplay" style="background-color: ${todaysChar.hint}; display: inline-flex; align-items: center; justify-content: center;">
                    Hint
                </div>`;
        }
    }
    
    if (isWon()) {
        input.disabled = true;
        const winDiv = document.getElementById('win');
        winDiv.style.display = '';
        winDiv.innerHTML = getWinDivInnerHTML();
    } else {
        input.disabled = false;
    }
}

function isWon() {
    const todaysChar = data[todaysCharIndex];
    return game.tries.includes(todaysChar.name);
}

function charName(date) {
    return data[getSeed(date) % data.length].name;
}