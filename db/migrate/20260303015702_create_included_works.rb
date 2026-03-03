class CreateIncludedWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :included_works do |t|
      t.references :work, null: false, foreign_key: true
      t.string :title

      t.timestamps
    end
  end
end
