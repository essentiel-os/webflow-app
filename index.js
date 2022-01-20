// Init WebState
WebState = {
    run: async function(endpoint, params = null) {
        const loaders = document.getElementsByClassName("loader");
        loaders.forEach((l) => l.style.display = "inherit");
        const data = {
            state: await idbKeyval.get("state")
        };
        if (params) data.params = params;
        console.log(endpoint, data);
        const {
            data: { tables, updatedState }
        } = await axios.post("https://dev--solucyon-backend.thomas-essentiel.autocode.gg/" + endpoint, data)
            .catch(function (error) {
                alert(error.message);
                if (error.response) {
                    console.log(error.response.data);
                } else if (error.request) {
                    console.log(error.request);
                } else {
                    console.log("Error", error.message);
                }
            });
        await idbKeyval.setMany(Object.keys(tables).map((table) => ([table, tables[table]])));
        await idbKeyval.set("state", updatedState);
        await WebState.build();
        loaders.forEach(l => l.style.display = "none");
    },
    getTable: async function(table, filters = null, fields = null) {
        let records = await idbKeyval.get(table);
        if (filters) {
            records = records.filter(record => {
                let i = 0;
                let valid = true;
                do {
                    const filter = filters[i];
                    switch (filter.operator) {
                        case "IS ANY OF":
                            valid = value.indexOf(record[filter.key]) > -1;
                            break;
                        default:
                            valid = record[filter.key] == filter.value;
                            break;
                    }
                    i++;
                } while (valid === true && i < filters.length);
                return valid;
            });
        }
        if (fields) {
            records = records.map(record => {
                const clone = {
                    id: record.id
                };
                for (let field of fields) {
                    clone[field] = record[field];
                }
                return clone;
            });
        }
        return records;
    },
    getActive: async function(name) {
        const state = await idbKeyval.get("state");
        return state[name];
    },
    setActive: async function(name, table, id) {
        const state = await idbKeyval.get("state");
        const [record] = await WebState.getTable(table, [{ key: 'id', value: id }]);
        state[name] = record;
        await idbKeyval.set("state", state);
        return state[name];
    },
    upsert: async function(table, records) {
        let data = await idbKeyval.get(table);
        for (let record of records) {
            if (record.id) {
                const index = data.findIndex(r => r.id === record.id);
                data[index] = record;
            } else {
                data.push(record);
            }
        }
        await idbKeyval.set(table, data);
        WebState.build();
        await WebState.run("upsert", { table, records });
        console.log("Upsert done!");
    },
    archive: async function(table, ids) {
        let data = await idbKeyval.get(table);
        data = data.filter(r => ids.indexOf(r.id) === -1);
        await idbKeyval.set(table, data);
        WebState.build();
        await WebState.run("archive", { table, ids });
        console.log("Archive done!");
    },
    build: async function() {
        // TODO : Build app's components
        /*const forms = document.querySelectorAll("form");
        forms.forEach(form => {
            form.onsubmit = event => {
                event.preventDefault();
                const data = new FormData(form);
                let record = {};
                for (const [name, value] of data) {
                    record[name] = value;
                }
                const table = form.getAttribute("data-webstate-table")
                WebState.upsert({
                    table,
                    records: [record]
                });
                form.reset();
            }
        });
        WebState.components.push(async () => {
            console.log("Load values");
            const elements = document.querySelectorAll("[data-webstate-field]");
            for (let element of elements) {
                const path = element.getAttribute("data-webstate-field");
                const [dependency, field] = path.split('.');
                const record = await WebState.get(dependency);
                element.value = record[field];
                element.disabled = element.getAttribute("data-webstate-disabled");
            }
        });*/
    },
    init: async function(params) {
        const user = await MemberStack.onReady;
        if (user.loggedIn === true) {
            await idbKeyval.set("state", {
                user: { 
                    memberstack_id: user.id, 
                    email: user.email
                } 
            });
            document.onload = WebState.build();
            await WebState.run('sync');
            console.log("Init done!");
        }
    }
}
WebState.init();
