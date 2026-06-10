const COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  enviada: "bg-blue-100 text-blue-700",
  aprobada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${COLORS[estado] || COLORS.borrador}`}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </span>
  );
}
