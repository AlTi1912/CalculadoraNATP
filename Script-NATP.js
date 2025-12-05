const display = document.getElementById('display');

function appendToDisplay(value) {
    if (display.value === '0' && value !== '.') {
        display.value = value;
    } else if (display.value === 'Error' || display.value === 'Infinity') {
        display.value = value;
    } else {
        display.value += value;
    }
}

function clearDisplay() {
    display.value = '0';
}

function deleteLast() {
    if (display.value === 'Error' || display.value === '0') {
        display.value = '0';
        return;
    }
    display.value = display.value.slice(0, -1);
    if (display.value === '') display.value = '0';
}

function calculateResult() {
    try {
        
        let expression = display.value.replace(/x/g, '*');
        
        let result = eval(expression);
        
        if (!isFinite(result)) {
            display.value = 'Infinity';
        } else {
            
            display.value = parseFloat(result.toFixed(8));
        }
    } catch (error) {
        display.value = 'Error';
    }
}


function calculateSquare() {
    try {
        let val = eval(display.value);
        display.value = Math.pow(val, 2);
    } catch {
        display.value = 'Error';
    }
}

function calculateSqrt() {
    try {
        let val = eval(display.value);
        if (val < 0) {
            display.value = 'Error'; 
        } else {
            display.value = Math.sqrt(val);
        }
    } catch {
        display.value = 'Error';
    }
}

function calculatePercentage() {
    try {
        let val = eval(display.value);
        display.value = val / 100;
    } catch {
        display.value = 'Error';
    }
}



document.addEventListener('keydown', function(event) {
    const key = event.key;

    if (/^[0-9+\-*/.()]$/.test(key)) {
        event.preventDefault(); 
        appendToDisplay(key);
    } 

    else if (key === 'Enter') {
        event.preventDefault(); 
        calculateResult();
    }
    else if (key === 'Backspace') {
        deleteLast();
    }
    else if (key === 'Escape') {
        clearDisplay();
    }
});