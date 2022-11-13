const fs = require('fs');

module.exports.write = function write(database) {
    fs.writeFileSync('database.json', JSON.stringify(database));
}