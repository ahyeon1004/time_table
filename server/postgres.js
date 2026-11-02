// Adapt the shared SQL store to Neon's parameterized HTTP driver.
export function postgresDatabase(sql) {
  function prepare(source) {
    let index = 0;
    const text = source.replace(/\?/g, () => `$${++index}`);
    function statement(values = []) {
      const query = () => {
        if (values.length !== index) throw new Error("SQL parameter count");
        return sql.query(text, values);
      };
      return {
        bind: (...args) => statement(args),
        query,
        async first() { return (await query())[0] ?? null; },
        async all() { return { results: await query() }; },
        async run() { await query(); return { success: true }; },
      };
    }
    return statement();
  }
  return {
    prepare,
    batch: (statements) => sql.transaction(statements.map((s) => s.query())),
  };
}
