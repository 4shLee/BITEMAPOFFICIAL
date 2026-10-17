<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;
use RuntimeException;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        // Seeds placeholder stock levels and overwrites existing rows: never for real data.
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'InventorySeeder creates placeholder stock and overwrites existing inventory; it is restricted to local and testing environments. '
                .'Enter real stock through the application.'
            );
        }

        $items = [
            [
                'item_name' => 'Anti-rabies Vaccine',
                'item_type' => 'Vaccine',
                'current_stock' => 120,
                'unit' => 'vials',
                'reorder_level' => 30,
                'expiry_date' => '2027-06-30',
            ],
            [
                'item_name' => 'Rabies Immunoglobulin',
                'item_type' => 'Immunoglobulin',
                'current_stock' => 25,
                'unit' => 'vials',
                'reorder_level' => 10,
                'expiry_date' => '2027-03-31',
            ],
            [
                'item_name' => 'Tetanus Toxoid',
                'item_type' => 'Medicine',
                'current_stock' => 45,
                'unit' => 'vials',
                'reorder_level' => 15,
                'expiry_date' => '2027-04-30',
            ],
            [
                'item_name' => 'Sterile Syringe',
                'item_type' => 'Supply',
                'current_stock' => 300,
                'unit' => 'pieces',
                'reorder_level' => 80,
                'expiry_date' => null,
            ],
            [
                'item_name' => 'Wound Care Kit',
                'item_type' => 'Supply',
                'current_stock' => 60,
                'unit' => 'kits',
                'reorder_level' => 20,
                'expiry_date' => null,
            ],
        ];

        foreach ($items as $item) {
            Inventory::updateOrCreate(
                ['item_name' => $item['item_name']],
                $item
            );
        }
    }
}
