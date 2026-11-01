/**
 * Taxonomy bánh xe hương vị SCA-WCR nạp sẵn cho client — chạy offline độc lập không cần server.
 */
var TAXONOMY_VERSION = "sca-wcr-v1";

function taxNode_(slug, vi, en, children) { return { slug: slug, vi: vi, en: en, children: children || [] }; }

var TAXONOMY_TREE = [
  taxNode_("fruity", "Trái cây", "Fruity", [
    taxNode_("berry", "Quả mọng", "Berry", [
      taxNode_("blackberry", "Mâm xôi đen", "Blackberry"), taxNode_("raspberry", "Mâm xôi", "Raspberry"),
      taxNode_("blueberry", "Việt quất", "Blueberry"), taxNode_("strawberry", "Dâu tây", "Strawberry")]),
    taxNode_("dried_fruit", "Trái cây khô", "Dried fruit", [
      taxNode_("raisin", "Nho khô", "Raisin"), taxNode_("prune", "Mận khô", "Prune")]),
    taxNode_("other_fruit", "Trái cây khác", "Other fruit", [
      taxNode_("coconut", "Dừa", "Coconut"), taxNode_("cherry", "Anh đào", "Cherry"),
      taxNode_("pomegranate", "Lựu", "Pomegranate"), taxNode_("pineapple", "Dứa", "Pineapple"),
      taxNode_("grape", "Nho", "Grape"), taxNode_("apple", "Táo", "Apple"), taxNode_("pear", "Lê", "Pear")]),
    taxNode_("citrus_fruit", "Cam quýt", "Citrus fruit", [
      taxNode_("grapefruit", "Bưởi", "Grapefruit"), taxNode_("orange", "Cam", "Orange"),
      taxNode_("lemon", "Chanh vàng", "Lemon"), taxNode_("lime", "Chanh xanh", "Lime")])
  ]),
  taxNode_("sour_fermented", "Chua/Lên men", "Sour/Fermented", [
    taxNode_("sour", "Chua", "Sour", [
      taxNode_("sour_aromatics", "Mùi chua", "Sour aromatics"), taxNode_("acetic_acid", "Axit axetic", "Acetic acid"),
      taxNode_("butyric_acid", "Axit butyric", "Butyric acid"), taxNode_("isovaleric_acid", "Axit isovaleric", "Isovaleric acid"),
      taxNode_("citric_acid", "Axit citric", "Citric acid"), taxNode_("malic_acid", "Axit malic", "Malic acid")]),
    taxNode_("alcohol_fermented", "Cồn/Lên men", "Alcohol/Fermented", [
      taxNode_("winey", "Rượu vang", "Winey"), taxNode_("whiskey", "Whisky", "Whiskey"),
      taxNode_("fermented", "Lên men", "Fermented"), taxNode_("overripe", "Chín quá", "Overripe")])
  ]),
  taxNode_("green_vegetative", "Xanh/Thực vật", "Green/Vegetative", [
    taxNode_("olive_oil", "Dầu ô liu", "Olive oil"), taxNode_("raw", "Sống", "Raw"),
    taxNode_("green_vegetative", "Xanh/Thực vật", "Green/Vegetative", [
      taxNode_("under_ripe", "Chưa chín", "Under-ripe"), taxNode_("peapod", "Vỏ đậu", "Peapod"),
      taxNode_("fresh", "Tươi", "Fresh"), taxNode_("dark_green", "Xanh đậm", "Dark green"),
      taxNode_("vegetative", "Thực vật", "Vegetative"), taxNode_("hay_like", "Giống cỏ khô", "Hay-like"),
      taxNode_("herb_like", "Giống thảo mộc", "Herb-like")])
  ]),
  taxNode_("other", "Khác", "Other", [
    taxNode_("papery_musty", "Giấy/Mốc", "Papery/Musty", [
      taxNode_("stale", "Ôi", "Stale"), taxNode_("cardboard", "Bìa carton", "Cardboard"),
      taxNode_("papery", "Giấy", "Papery"), taxNode_("woody", "Gỗ", "Woody"),
      taxNode_("moldy_damp", "Mốc/ẩm", "Moldy/Damp"), taxNode_("musty_earthy", "Mốc/đất", "Musty/Earthy"),
      taxNode_("animalic", "Mùi động vật", "Animalic"), taxNode_("meaty_brothy", "Thịt/nước hầm", "Meaty/Brothy"),
      taxNode_("phenolic", "Phenolic", "Phenolic")]),
    taxNode_("chemical", "Hoá chất", "Chemical", [
      taxNode_("bitter", "Đắng", "Bitter"), taxNode_("salty", "Mặn", "Salty"),
      taxNode_("medicinal", "Thuốc", "Medicinal"), taxNode_("petroleum", "Dầu mỏ", "Petroleum"),
      taxNode_("skunky", "Mùi chồn hôi", "Skunky"), taxNode_("rubber", "Cao su", "Rubber")])
  ]),
  taxNode_("roasted", "Rang", "Roasted", [
    taxNode_("pipe_tobacco", "Thuốc lá tẩu", "Pipe tobacco"), taxNode_("tobacco", "Thuốc lá", "Tobacco"),
    taxNode_("burnt", "Cháy", "Burnt", [
      taxNode_("acrid", "Hắc/khét", "Acrid"), taxNode_("ashy", "Tro", "Ashy"),
      taxNode_("smoky", "Khói", "Smoky"), taxNode_("brown_roast", "Rang nâu", "Brown roast")]),
    taxNode_("cereal", "Ngũ cốc", "Cereal", [
      taxNode_("grain", "Hạt ngũ cốc", "Grain"), taxNode_("malt", "Mạch nha", "Malt")])
  ]),
  taxNode_("spices", "Gia vị", "Spices", [
    taxNode_("pungent", "Hăng cay", "Pungent"), taxNode_("pepper", "Tiêu", "Pepper"),
    taxNode_("brown_spice", "Gia vị nâu", "Brown spice", [
      taxNode_("anise", "Hồi", "Anise"), taxNode_("nutmeg", "Nhục đậu khấu", "Nutmeg"),
      taxNode_("cinnamon", "Quế", "Cinnamon"), taxNode_("clove", "Đinh hương", "Clove")])
  ]),
  taxNode_("nutty_cocoa", "Quả hạch/Cacao", "Nutty/Cocoa", [
    taxNode_("nutty", "Quả hạch", "Nutty", [
      taxNode_("peanuts", "Đậu phộng", "Peanuts"), taxNode_("hazelnut", "Hạt phỉ", "Hazelnut"),
      taxNode_("almond", "Hạnh nhân", "Almond")]),
    taxNode_("cocoa", "Cacao", "Cocoa", [
      taxNode_("chocolate", "Sô cô la", "Chocolate"), taxNode_("dark_chocolate", "Sô cô la đen", "Dark chocolate")])
  ]),
  taxNode_("sweet", "Ngọt", "Sweet", [
    taxNode_("brown_sugar", "Đường nâu", "Brown sugar", [
      taxNode_("molasses", "Mật mía", "Molasses"), taxNode_("maple_syrup", "Siro phong", "Maple syrup"),
      taxNode_("caramelized", "Caramen hoá", "Caramelized"), taxNode_("honey", "Mật ong", "Honey")]),
    taxNode_("vanilla", "Vani", "Vanilla"), taxNode_("vanillin", "Vanillin", "Vanillin"),
    taxNode_("overall_sweet", "Ngọt tổng thể", "Overall sweet"), taxNode_("sweet_aromatics", "Hương ngọt", "Sweet aromatics")
  ]),
  taxNode_("floral", "Hoa", "Floral", [
    taxNode_("black_tea", "Trà đen", "Black tea"),
    taxNode_("floral", "Hoa", "Floral", [
      taxNode_("chamomile", "Hoa cúc", "Chamomile"), taxNode_("rose", "Hoa hồng", "Rose"),
      taxNode_("jasmine", "Hoa nhài", "Jasmine")])
  ])
];
TAXONOMY_TREE[3].guest_hidden = true;

function taxonomyForClient() {
  function map(node, prefix) {
    var code = prefix ? prefix + "." + node.slug : node.slug;
    return { code: code, vi: node.vi, en: node.en, children: node.children.map(function (c) { return map(c, code); }) };
  }
  return TAXONOMY_TREE.map(function (g) {
    var m = map(g, "");
    m.guest_hidden = !!g.guest_hidden;
    return m;
  });
}

var TAXONOMY_DEFAULT = taxonomyForClient();
