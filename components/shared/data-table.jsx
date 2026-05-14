import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DataTable({ 
  title, 
  description, 
  columns, 
  data, 
  actions,
  className 
}) {
  return (
    <Card className={cn('', className)}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent className={!title ? 'pt-6' : ''}>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {columns.map((column, index) => (
                  <th 
                    key={index}
                    className={cn(
                      'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
                      column.className
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length} 
                    className="h-24 text-center text-muted-foreground"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                data.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    {columns.map((column, colIndex) => (
                      <td 
                        key={colIndex}
                        className={cn('p-4 align-middle', column.cellClassName)}
                      >
                        {column.cell ? column.cell(row) : row[column.accessor]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
