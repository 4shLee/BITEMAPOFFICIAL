<?php

namespace App\Support;

final class InventoryProductCatalog
{
    /**
     * Approved Animal Bite Center product catalog based on clinic interview records.
     *
     * @var array<int, array{
     *     key: string,
     *     product_name: string,
     *     brand: string,
     *     item_name: string,
     *     item_type: string,
     *     purpose: string,
     *     is_pep_vaccine: bool,
     *     aliases: array<int, string>
     * }>
     */
    public const PRODUCTS = [
        [
            'key' => 'anti_rabies_vaccine',
            'product_name' => 'Anti-Rabies Vaccine',
            'brand' => 'Abhayrab',
            'item_name' => 'Anti-Rabies Vaccine — Abhayrab',
            'item_type' => 'Vaccine',
            'purpose' => 'PEP for all bite categories.',
            'is_pep_vaccine' => true,
            'aliases' => [
                'anti-rabies vaccine — abhayrab',
                'anti-rabies vaccine - abhayrab',
                'anti-rabies vaccine (abhayrab)',
                'anti-rabies vaccine',
                'anti rabies vaccine',
                'abhayrab',
            ],
        ],
        [
            'key' => 'tetanus_toxoid',
            'product_name' => 'Tetanus Toxoid',
            'brand' => 'Abhaytox / Bett',
            'item_name' => 'Tetanus Toxoid — Abhaytox / Bett',
            'item_type' => 'Vaccine',
            'purpose' => 'Active tetanus immunization.',
            'is_pep_vaccine' => false,
            'aliases' => [
                'tetanus toxoid — abhaytox / bett',
                'tetanus toxoid - abhaytox / bett',
                'tetanus toxoid (abhaytox / bett)',
                'tetanus toxoid',
                'abhaytox / bett',
                'abhaytox',
                'bett',
            ],
        ],
        [
            'key' => 'equine_rig',
            'product_name' => 'Equine RIG (eRIG)',
            'brand' => 'Equirab',
            'item_name' => 'Equine RIG (eRIG) — Equirab',
            'item_type' => 'Immunoglobulin',
            'purpose' => 'Passive immunization; Category III according to the interview record.',
            'is_pep_vaccine' => false,
            'aliases' => [
                'equine rig (erig) — equirab',
                'equine rig (erig) - equirab',
                'equine rig (erig)',
                'equine rig',
                'equirab',
            ],
        ],
        [
            'key' => 'human_rig',
            'product_name' => 'Human RIG (hRIG)',
            'brand' => 'Berirab',
            'item_name' => 'Human RIG (hRIG) — Berirab',
            'item_type' => 'Immunoglobulin',
            'purpose' => 'Passive immunization; Category III according to the interview record.',
            'is_pep_vaccine' => false,
            'aliases' => [
                'human rig (hrig) — berirab',
                'human rig (hrig) - berirab',
                'human rig (hrig)',
                'human rig',
                'berirab',
            ],
        ],
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function all(): array
    {
        return array_map(fn (array $item) => [
            'key' => $item['key'],
            'product_name' => $item['product_name'],
            'brand' => $item['brand'],
            'item_name' => $item['item_name'],
            'label' => $item['item_name'],
            'item_type' => $item['item_type'],
            'purpose' => $item['purpose'],
            'is_pep_vaccine' => $item['is_pep_vaccine'],
        ], self::PRODUCTS);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function match(?string $itemName, ?string $brand = null): ?array
    {
        $normalizedName = self::normalize($itemName);
        if ($normalizedName === '') {
            return null;
        }

        foreach (self::PRODUCTS as $product) {
            if (
                $normalizedName === self::normalize($product['item_name'])
                || $normalizedName === self::normalize($product['product_name'])
                || $normalizedName === self::normalize($product['key'])
                || in_array($normalizedName, array_map([self::class, 'normalize'], $product['aliases']), true)
            ) {
                return $product;
            }
        }

        $normalizedBrand = self::normalize($brand);
        if ($normalizedBrand !== '') {
            foreach (self::PRODUCTS as $product) {
                if ($normalizedBrand === self::normalize($product['brand'])) {
                    return $product;
                }
            }
        }

        return null;
    }

    /**
     * Returns normalized lowercase names that identify the same product in the inventory table.
     *
     * @return array<int, string>
     */
    public static function duplicateNamesFor(string $itemName): array
    {
        $normalized = self::normalize($itemName);
        $matched = self::match($itemName);

        if (! $matched) {
            return $normalized !== '' ? [$normalized] : [];
        }

        return array_values(array_unique(array_map([self::class, 'normalize'], [
            $matched['item_name'],
            $matched['product_name'],
            ...$matched['aliases'],
        ])));
    }

    public static function isEligiblePepAntiRabiesVaccine(?string $itemName, ?string $brand = null): bool
    {
        $matched = self::match($itemName, $brand);
        if ($matched !== null) {
            return (bool) $matched['is_pep_vaccine'];
        }

        $haystack = self::normalize(trim((string) $itemName.' '.(string) $brand));
        if ($haystack === '') {
            return false;
        }

        $isExcludedNonPepProduct = str_contains($haystack, 'immunoglobulin')
            || preg_match('/(^|[^a-z])(?:e|h)?rig([^a-z]|$)/i', $haystack) === 1
            || str_contains($haystack, 'tetanus')
            || str_contains($haystack, 'toxoid')
            || str_contains($haystack, 'ats')
            || str_contains($haystack, 'abhaytox')
            || str_contains($haystack, 'bett')
            || str_contains($haystack, 'equirab')
            || str_contains($haystack, 'berirab');

        if ($isExcludedNonPepProduct) {
            return false;
        }

        return preg_match(
            '/(^|[^a-z])(anti[\s-]?rabies|antirabies|rabies|vaccine|arv|pcecv|pvrv|abhayrab|verorab|speeda|rabipur|vaxirab|indarab|rabivax|chirorab)([^a-z]|$)/i',
            $haystack
        ) === 1;
    }

    public static function normalize(?string $value): string
    {
        $normalizedDashes = preg_replace('/[\x{2010}-\x{2015}\x{2212}]+/u', '-', (string) ($value ?? ''));

        return (string) str($normalizedDashes ?? '')
            ->trim()
            ->squish()
            ->lower();
    }
}
