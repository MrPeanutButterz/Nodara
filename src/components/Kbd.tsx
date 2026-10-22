/** Key caps for a shortcut, e.g. <Kbd keys={[MOD, 'K']} />. */
export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="keys">
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  )
}
