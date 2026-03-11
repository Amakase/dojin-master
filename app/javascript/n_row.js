window.scrollRow = function(btn, direction){

  const row = btn.parentElement.querySelector(".netflix-row")

  const scrollAmount = 600

  row.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth"
  })

}
