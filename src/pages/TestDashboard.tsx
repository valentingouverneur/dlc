import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BarChart } from "@tremor/react"

const TestDashboard = () => {
  const chartData = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
    { name: "Mar", value: 200 },
    { name: "Apr", value: 278 },
    { name: "May", value: 189 },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Test Dashboard - Shadcn UI + Tremor</h1>
      
      {/* Shadcn UI Components */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shadcn Card</CardTitle>
            <CardDescription>Test d'un composant Shadcn UI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Test input" />
            <div className="flex gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tremor Chart</CardTitle>
            <CardDescription>Test d'un graphique Tremor</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData}
              index="name"
              categories={["value"]}
              colors={["blue"]}
              yAxisWidth={48}
            />
          </CardContent>
        </Card>
      </div>

      {/* Table Test */}
      <Card>
        <CardHeader>
          <CardTitle>Table Example</CardTitle>
          <CardDescription>Exemple de tableau avec Shadcn UI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left font-semibold">Nom</th>
                  <th className="p-4 text-left font-semibold">Valeur</th>
                  <th className="p-4 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((item) => (
                  <tr key={item.name} className="border-b">
                    <td className="p-4">{item.name}</td>
                    <td className="p-4">{item.value}</td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm">Voir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TestDashboard
