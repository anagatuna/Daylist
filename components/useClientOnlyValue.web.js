import React from 'react';

export function useClientOnlyValue(server, client) {
  const [value, setValue] = React.useState(server);
  React.useEffect(() => {
    setValue(client);
  }, [client]);

  return value;
}
